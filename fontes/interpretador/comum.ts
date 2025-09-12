import { InterpretadorInterface, RetornoInterpretadorInterface } from '@designliquido/delegua';
import { AcessoIndiceVariavel, Construto, Leia, Literal, Variavel } from '@designliquido/delegua/construtos';
import { Declaracao, Para } from '@designliquido/delegua/declaracoes';
import { EspacoMemoria } from '@designliquido/delegua/interpretador/espaco-memoria';
import { ErroEmTempoDeExecucao } from '@designliquido/delegua/excecoes';
import { EscopoExecucao } from '@designliquido/delegua/interfaces/escopo-execucao';
import { ContinuarQuebra, Quebra, SustarQuebra } from '@designliquido/delegua/quebras';

function converterTipoOuEstourarErro(valor: any, tipo: string) {
    try {
        switch (tipo) {
            case 'texto':
                return String(valor);
            case 'número':
                if ((valor as string).includes('.')) {
                    return parseFloat(valor);
                }
                var numero = Number(valor);
                if (isNaN(numero)) {
                    throw new Error(`Não foi possível converter o valor "${valor}" para o tipo ${tipo}.`);
                }
                return numero;
            default:
                return valor;
        }
    } catch (err) {
        throw new Error(`Não foi possível converter o valor "${valor}" para o tipo ${tipo}.`);
    }
}

export async function atribuirVariavel(
    interpretador: InterpretadorInterface,
    expressao: Construto,
    valor: any,
    tipo: string
): Promise<any> {
    valor = converterTipoOuEstourarErro(valor, tipo);

    if (expressao instanceof Variavel) {
        interpretador.pilhaEscoposExecucao.atribuirVariavel(expressao.simbolo, valor);
        return;
    }

    if (expressao instanceof AcessoIndiceVariavel) {
        const promises = await Promise.all([
            interpretador.avaliar(expressao.entidadeChamada),
            interpretador.avaliar(expressao.indice),
        ]);

        let alvo = promises[0];
        let indice = promises[1];
        const subtipo = alvo.hasOwnProperty('subtipo') ? alvo.subtipo : undefined;

        if (alvo.hasOwnProperty('valor')) {
            alvo = alvo.valor;
        }

        if (indice.hasOwnProperty('valor')) {
            indice = indice.valor;
        }

        let valorResolvido;
        switch (subtipo) {
            case 'texto':
                valorResolvido = String(valor);
                break;
            case 'número':
                valorResolvido = Number(valor);
                break;
            case 'lógico':
                valorResolvido = Boolean(valor);
                break;
            default:
                valorResolvido = valor;
                break;
        }

        alvo[indice] = valorResolvido;
    }
}

export async function avaliarArgumentosEscreva(
    interpretador: InterpretadorInterface,
    argumentos: Construto[]
): Promise<string> {
    let formatoTexto: string = '';
    let quantidadeInterpolacoes: RegExpMatchArray;

    if (argumentos.length < 1) {
        throw new Error('Escreva precisa de pelo menos um argumento.');
    }

    if (typeof argumentos[0].valor !== 'string') {
        throw new Error('O primeiro argumento de Escreva precisa ser uma string.');
    }

    // TODO: Implementar interface se necessário.
    quantidadeInterpolacoes = await (interpretador as any).resolverQuantidadeDeInterpolacoes(argumentos[0] as Literal);

    const resultadoAvaliacaoLiteral = await interpretador.avaliar(argumentos[0]);

    if (quantidadeInterpolacoes === null) {
        formatoTexto = resultadoAvaliacaoLiteral?.hasOwnProperty('valor')
            ? resultadoAvaliacaoLiteral.valor
            : resultadoAvaliacaoLiteral;
        return formatoTexto;
    }

    if (!(argumentos.length - 1 === quantidadeInterpolacoes.length)) {
        throw new Error('Quantidade de argumentos não bate com quantidade de interpolacoes.');
    }

    formatoTexto = resultadoAvaliacaoLiteral;

    for (let i = 0; i < quantidadeInterpolacoes.length; i++) {
        const dados = {
            tipo: quantidadeInterpolacoes[i].replace('%', ''),
            valor: await interpretador.avaliar(argumentos[i + 1]),
        };

        // TODO: Implementar interface se necessário.
        if ((interpretador as any).verificarTipoDaInterpolacao(dados)) {
            formatoTexto = await (interpretador as any).substituirValor(formatoTexto, dados.valor, dados.tipo);
        }
    }

    return formatoTexto.trimEnd();
}

export async function resolverQuantidadeDeInterpolacoes(texto: Literal): Promise<RegExpMatchArray> {
    const stringOriginal: string = texto.valor;
    const regex = /%[a-zA-Z]/g;

    const matches = stringOriginal.match(regex);

    return matches;
}

export async function verificarTipoDaInterpolacao(dados: { tipo: string; valor: any }) {
    switch (dados.tipo) {
        case 'd':
        case 'i':
        case 'u':
            const valor = dados.valor.hasOwnProperty('valor') ? dados.valor.valor : dados.valor;
            if (typeof valor !== 'number') {
                throw new Error('O valor interpolado não é um número.');
            }
            return true;
        case 'c':
        case 's':
            const valorString = dados.valor.hasOwnProperty('valor') ? dados.valor.valor : dados.valor;
            if (typeof valorString !== 'string') {
                throw new Error('O valor interpolado não é um caractere.');
            }
            return true;
        default:
            throw new Error('Tipo de interpolação não suportado.');
    }
}

export async function substituirValor(
    stringOriginal: string,
    novoValor: number | string | any,
    simboloTipo: string
): Promise<string> {
    let substituida = false;
    let resultado = '';

    for (let i = 0; i < stringOriginal.length; i++) {
        if (stringOriginal[i] === '%' && stringOriginal[i + 1] === simboloTipo && !substituida) {
            switch (simboloTipo) {
                case 'd':
                case 'i':
                case 'u':
                case 'f':
                case 'F':
                case 'e':
                case 'E':
                case 'g':
                case 'G':
                case 'x':
                case 'X':
                case 'o':
                case 'c':
                case 's':
                case 'p':
                    resultado += novoValor.hasOwnProperty('valor') ? novoValor.valor : novoValor;
                    break;
                default:
                    resultado += stringOriginal[i];
                    break;
            }
            substituida = true;
            i++;
        } else {
            resultado += stringOriginal[i];
        }
    }

    return resultado;
}

export async function visitarExpressaoLeia(interpretador: InterpretadorInterface, expressao: Leia): Promise<any> {
    /**
     * Em Birl não se usa mensagem junto com o prompt, normalmente se usa um Escreva antes.
     */
    const mensagem = '> ';
    const promessaLeitura: Function = () =>
        new Promise((resolucao) =>
            interpretador.interfaceEntradaSaida.question(mensagem, (resposta: any) => {
                resolucao(resposta);
            })
        );

    const valorLido = await promessaLeitura();
    await atribuirVariavel(interpretador, expressao.argumentos[0], valorLido, expressao.argumentos[1].valor);

    return;
}

export async function visitarExpressaoLiteral(expressao: Literal): Promise<any> {
    return Promise.resolve(expressao.valor);
}

export async function visitarDeclaracaoPara(interpretador: InterpretadorInterface, declaracao: Para): Promise<any> {
    if (declaracao.inicializador !== null) {
        if (declaracao.inicializador instanceof Array) {
            if (declaracao.inicializador[0] instanceof Variavel) {
                const valor = await interpretador.avaliar(declaracao.inicializador[1]);
                interpretador.pilhaEscoposExecucao.atribuirVariavel(declaracao.inicializador[0].simbolo, valor);
            }
        } else {
            await interpretador.avaliar(declaracao.inicializador);
        }
    }

    let retornoExecucao: any;
    while (!(retornoExecucao instanceof Quebra)) {
        if (
            declaracao.condicao !== null &&
            !interpretador.eVerdadeiro(await interpretador.avaliar(declaracao.condicao))
        ) {
            break;
        }

        try {
            retornoExecucao = await interpretador.executar(declaracao.corpo, false);
            if (retornoExecucao instanceof SustarQuebra) {
                return null;
            }

            if (retornoExecucao instanceof ContinuarQuebra) {
                retornoExecucao = null;
            }
        } catch (erro: any) {
            interpretador.erros.push({
                erroInterno: erro,
                linha: declaracao.linha,
                hashArquivo: declaracao.hashArquivo,
            });
            return Promise.reject(erro);
        }

        if (declaracao.incrementar !== null) {
            await interpretador.avaliar(declaracao.incrementar);
        }
    }

    return retornoExecucao;
}

export async function interpretar(
    interpretador: InterpretadorInterface,
    declaracoes: Declaracao[],
    manterAmbiente?: boolean
): Promise<RetornoInterpretadorInterface> {
    interpretador.erros = [];

    const escopoExecucao: EscopoExecucao = {
        declaracoes: declaracoes,
        declaracaoAtual: 0,
        espacoMemoria: new EspacoMemoria(),
        finalizado: false,
        tipo: 'outro',
        emLacoRepeticao: false,
    };
    interpretador.pilhaEscoposExecucao.empilhar(escopoExecucao);

    try {
        // TODO: Implementar interface se necessário.
        const retornoOuErro = await (interpretador as any).executarUltimoEscopo(manterAmbiente);
        if (retornoOuErro instanceof ErroEmTempoDeExecucao) {
            interpretador.erros.push(retornoOuErro);
        }
    } catch (erro: any) {
        interpretador.erros.push({
            erroInterno: erro,
            linha: -1,
            hashArquivo: -1,
        });
    } finally {
        // TODO: Implementar interface se necessário.
        const retorno = {
            erros: interpretador.erros,
            resultado: (interpretador as any).resultadoInterpretador,
        } as RetornoInterpretadorInterface;

        (interpretador as any).resultadoInterpretador = [];
        return retorno;
    }
}
