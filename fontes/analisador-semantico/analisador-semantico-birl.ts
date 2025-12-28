import {
    Agrupamento,
    Atribuir,
    Binario,
    Chamada,
    Leia,
    Literal,
    Logico,
    Separador,
    Variavel,
    Vetor,
} from '@designliquido/delegua/construtos';
import {
    Declaracao,
    Const,
    Enquanto,
    Escolha,
    Escreva,
    Expressao,
    FuncaoDeclaracao,
    Retorna,
    Var
} from '@designliquido/delegua/declaracoes';
import { DiagnosticoAnalisadorSemantico, DiagnosticoSeveridade, ParametroInterface, SimboloInterface } from '@designliquido/delegua/interfaces';
import { RetornoAnalisadorSemantico } from '@designliquido/delegua/interfaces/retornos/retorno-analisador-semantico';
import { RetornoQuebra } from '@designliquido/delegua/quebras';
import { AnalisadorSemanticoBase } from '@designliquido/delegua/analisador-semantico/analisador-semantico-base';
import { PilhaVariaveis } from '@designliquido/delegua/analisador-semantico/pilha-variaveis';
import { FuncaoHipoteticaInterface } from '@designliquido/delegua/analisador-semantico/funcao-hipotetica-interface';
import { GerenciadorEscopos } from '@designliquido/delegua/analisador-semantico/gerenciador-escopos';

interface VariavelHipoteticaBirlInterface {
    tipo:
        | 'texto'
        | 'número'
        | 'longo'
        | 'vetor'
        | 'dicionário'
        | 'nulo'
        | 'lógico'
        | 'função'
        | 'símbolo'
        | 'objeto'
        | 'módulo';
    subtipo?: 'texto' | 'número' | 'longo' | 'lógico';
    imutavel: boolean;
}

export class AnalisadorSemanticoBirl extends AnalisadorSemanticoBase {
    pilhaVariaveis: PilhaVariaveis;
    funcoes: { [nomeFuncao: string]: FuncaoHipoteticaInterface };
    atual: number;
    diagnosticos: DiagnosticoAnalisadorSemantico[];

    constructor() {
        super();
        this.pilhaVariaveis = new PilhaVariaveis();
        this.funcoes = {};
        this.atual = 0;
        this.diagnosticos = [];
    }

    /**
     * Verifica se o tipo atribuído é compatível com a declaração
     */
    verificarTipoAtribuido(declaracao: Var | Const): void {
        if (declaracao.tipo) {
            // Verifica vetores
            if (['vetor', 'qualquer[]', 'inteiro[]', 'texto[]'].includes(declaracao.tipo)) {
                if (declaracao.inicializador instanceof Vetor) {
                    const vetor = declaracao.inicializador;
                    const vetorSemSeparadores = vetor.valores.filter(
                        (v) => v.constructor !== Separador
                    );

                    if (declaracao.tipo === 'inteiro[]') {
                        const apenasValores = vetorSemSeparadores.find(
                            (v: any) => typeof v?.valor !== 'number'
                        );
                        if (apenasValores) {
                            this.erro(
                                declaracao.simbolo,
                                `Atribuição inválida para '${declaracao.simbolo.lexema}': é esperado um valor do tipo vetor de inteiro ou real. Atual: ${vetor.tipo}.`
                            );
                        }
                    }

                    if (declaracao.tipo === 'texto[]') {
                        const apenasValores = vetorSemSeparadores.find(
                            (v: any) => typeof v?.valor !== 'string'
                        );
                        if (apenasValores) {
                            this.erro(
                                declaracao.simbolo,
                                `Atribuição inválida para '${declaracao.simbolo.lexema}': é esperado um valor do tipo vetor de texto. Atual: ${vetor.tipo}.`
                            );
                        }
                    }
                } else {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}': é esperado um vetor de elementos.`
                    );
                }
            }

            // Verifica literais
            if (declaracao.inicializador instanceof Literal) {
                const literal = declaracao.inicializador;
                if (declaracao.tipo === 'texto' && literal.tipo !== 'texto') {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}': é esperado um valor do tipo texto. Atual: ${literal.tipo}.`
                    );
                }

                if (
                    ['inteiro', 'número', 'real'].includes(declaracao.tipo) &&
                    !['inteiro', 'número', 'real'].includes(literal.tipo)
                ) {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}': é esperado um valor do tipo número. Atual: ${literal.tipo}.`
                    );
                }
            }

            // Verifica leia()
            if (declaracao.inicializador instanceof Leia) {
                if (!['qualquer', 'texto'].includes(declaracao.tipo)) {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}', Função 'leia()' sempre retorna 'texto'.`
                    );
                }
            }
        }
    }

    /**
     * Compara argumentos de chamada contra parâmetros da função
     */
    protected comparacaoArgumentosContraParametrosFuncao(
        simboloFuncao: SimboloInterface,
        parametros: ParametroInterface[],
        argumentos: any[]
    ): void {
        if (parametros.length !== argumentos.length) {
            this.erro(
                simboloFuncao,
                `Função '${simboloFuncao.lexema}' espera ${parametros.length} parâmetros. Atual: ${argumentos.length}.`
            );
        }

        for (let [indice, parametro] of parametros.entries()) {
            const argumento = argumentos[indice];
            if (argumento) {
                if (parametro.tipoDado === 'texto' && argumento.tipo !== 'texto') {
                    this.erro(
                        simboloFuncao,
                        `O valor passado para o parâmetro '${parametro.nome.lexema}' (${parametro.tipoDado}) é diferente do esperado pela função (${argumento.tipo}).`
                    );
                } else if (['inteiro', 'número', 'real'].includes(parametro.tipoDado)) {
                    // Delégua pode trabalhar com conversões implícitas entre tipos numéricos
                    if (!['inteiro', 'número', 'real'].includes(argumento.tipo)) {
                        this.erro(
                            simboloFuncao,
                            `O valor passado para o parâmetro '${parametro.nome.lexema}' (${parametro.tipoDado}) é diferente do esperado pela função (${argumento.tipo}).`
                        );
                    }
                }
            }
        }
    }

    /**
     * Visita expressão de chamada de função
     */
    visitarExpressaoDeChamada(expressao: Chamada): Promise<void> {
        // Marca argumentos que são variáveis como usadas
        for (const argumento of expressao.argumentos) {
            if (argumento instanceof Variavel) {
                this.gerenciadorEscopos.marcarComoUsada(argumento.simbolo.lexema);
            }
        }

        // Verifica se é uma chamada por variável
        if (expressao.entidadeChamada instanceof Variavel) {
            const entidadeChamadaVariavel = expressao.entidadeChamada;
            const funcaoChamada =
                this.gerenciadorEscopos.buscar(entidadeChamadaVariavel.simbolo.lexema) ||
                this.funcoes[entidadeChamadaVariavel.simbolo.lexema];

            if (!funcaoChamada) {
                this.erro(
                    entidadeChamadaVariavel.simbolo,
                    `Chamada da função '${entidadeChamadaVariavel.simbolo.lexema}' não existe.`
                );
                return Promise.resolve();
            }

            const funcao = funcaoChamada.valor;
            this.comparacaoArgumentosContraParametrosFuncao(
                entidadeChamadaVariavel.simbolo,
                funcao.parametros,
                expressao.argumentos
            );
        }

        return Promise.resolve();
    }

    /**
     * Visita expressão de atribuição
     */
    visitarExpressaoDeAtribuicao(expressao: Atribuir): Promise<void> {
        let simboloAlvo: SimboloInterface;

        // Obtém o símbolo do alvo
        if (expressao.alvo instanceof Variavel) {
            const alvoVariavel = expressao.alvo;
            simboloAlvo = alvoVariavel.simbolo;
        } else {
            return Promise.resolve();
        }

        // Busca a variável no escopo
        const variavel = this.gerenciadorEscopos.buscar(simboloAlvo.lexema);
        if (!variavel) {
            this.erro(
                simboloAlvo,
                `Variável '${simboloAlvo.lexema}' ainda não foi declarada até este ponto.`
            );
            return Promise.resolve();
        }

        // Verifica se é constante
        if (variavel.imutavel) {
            this.erro(simboloAlvo, `Constante '${simboloAlvo.lexema}' não pode ser modificada.`);
            return Promise.resolve();
        }

        // Marca como inicializada após atribuição
        this.gerenciadorEscopos.marcarComoInicializada(simboloAlvo.lexema, expressao.valor);

        // Verifica tipos se a variável tem tipo definido
        if (variavel.tipo) {
            if (expressao.valor instanceof Literal && variavel.tipo.includes('[]')) {
                this.erro(
                    simboloAlvo,
                    `Atribuição inválida, esperado tipo '${variavel.tipo}' na atribuição.`
                );
                return Promise.resolve();
            }

            if (expressao.valor instanceof Vetor && !variavel.tipo.includes('[]')) {
                this.erro(
                    simboloAlvo,
                    `Atribuição inválida, esperado tipo '${variavel.tipo}' na atribuição.`
                );
                return Promise.resolve();
            }

            if (expressao.valor instanceof Literal) {
                let valorLiteral = typeof expressao.valor.valor;
                if (!['qualquer'].includes(variavel.tipo)) {
                    if (valorLiteral === 'string' && variavel.tipo !== 'texto') {
                        this.erro(simboloAlvo, `Esperado tipo '${variavel.tipo}' na atribuição.`);
                        return Promise.resolve();
                    }

                    if (
                        valorLiteral === 'number' &&
                        !['inteiro', 'número', 'real'].includes(variavel.tipo)
                    ) {
                        this.erro(simboloAlvo, `Esperado tipo '${variavel.tipo}' na atribuição.`);
                        return Promise.resolve();
                    }
                }
            }

            if (expressao.valor instanceof Vetor) {
                let valoresSemSeparador = expressao.valor.valores.filter(
                    (v) => v.constructor !== Separador
                );
                if (!['qualquer[]'].includes(variavel.tipo)) {
                    if (variavel.tipo === 'texto[]') {
                        if (!valoresSemSeparador.every((v: any) => typeof v.valor === 'string')) {
                            this.erro(
                                simboloAlvo,
                                `Esperado tipo '${variavel.tipo}' na atribuição.`
                            );
                            return Promise.resolve();
                        }
                    }

                    if (['inteiro[]', 'numero[]'].includes(variavel.tipo)) {
                        if (!valoresSemSeparador.every((v: any) => typeof v.valor === 'number')) {
                            this.erro(
                                simboloAlvo,
                                `Esperado tipo '${variavel.tipo}' na atribuição.`
                            );
                            return Promise.resolve();
                        }
                    }
                }
            }
        }

        return Promise.resolve();
    }

    /**
     * Visita declaração de expressão
     */
    async visitarDeclaracaoDeExpressao(declaracao: Expressao): Promise<any> {
        return await declaracao.expressao.aceitar(this);
    }

    /**
     * Visita declaração escolha (switch)
     */
    visitarDeclaracaoEscolha(declaracao: Escolha): Promise<void> {
        const identificadorOuLiteral = declaracao.identificadorOuLiteral as any;
        const tipo = identificadorOuLiteral.tipo;

        for (let caminho of declaracao.caminhos) {
            for (let condicao of caminho.condicoes) {
                if (condicao instanceof Literal) {
                    const condicaoLiteral = condicao;
                    if (condicaoLiteral.tipo !== tipo) {
                        this.erro(
                            {
                                lexema: condicaoLiteral.valor,
                                tipo: condicaoLiteral.tipo,
                                linha: condicaoLiteral.linha,
                                hashArquivo: condicaoLiteral.hashArquivo,
                            } as SimboloInterface,
                            `'caso ${condicaoLiteral.valor}:' não é do mesmo tipo esperado em 'escolha' (esperado: ${tipo}, atual: ${condicaoLiteral.tipo}).`
                        );
                    }
                } else if (condicao instanceof Variavel) {
                    const condicaoVariavel = condicao;
                    this.verificarVariavel(condicaoVariavel);
                    const variavelHipotetica = this.gerenciadorEscopos.buscar(
                        condicaoVariavel.simbolo.lexema
                    );
                    if (variavelHipotetica && typeof variavelHipotetica.valor !== tipo) {
                        this.erro(
                            condicaoVariavel.simbolo,
                            `'caso ${condicaoVariavel.simbolo.lexema}:' não é do mesmo tipo esperado em 'escolha'`
                        );
                    }
                }
            }
        }

        return Promise.resolve();
    }

    /**
     * Visita declaração enquanto (while)
     */
    visitarDeclaracaoEnquanto(declaracao: Enquanto): Promise<void> {
        return this.verificarCondicao(declaracao.condicao);
    }

    /**
     * Verifica uma condição (usada em enquanto, se, etc)
     */
    private verificarCondicao(condicao: any): Promise<void> {
        if (condicao instanceof Agrupamento) {
            return this.verificarCondicao(condicao.expressao);
        }

        if (condicao instanceof Variavel) {
            return this.verificarVariavelBinaria(condicao);
        }

        if (condicao instanceof Binario) {
            return this.verificarBinario(condicao);
        }

        if (condicao instanceof Logico) {
            return this.verificarLogico(condicao);
        }

        if (condicao instanceof Chamada) {
            return this.verificarChamada(condicao);
        }

        return Promise.resolve();
    }

    /**
     * Verifica variável em contexto binário
     */
    private verificarVariavelBinaria(variavel: Variavel): Promise<void> {
        this.verificarVariavel(variavel);
        const variavelHipotetica = this.gerenciadorEscopos.buscar(variavel.simbolo.lexema);

        if (
            variavelHipotetica &&
            !(variavelHipotetica.valor instanceof Binario) &&
            typeof variavelHipotetica.valor !== 'boolean'
        ) {
            this.erro(variavel.simbolo, `Esperado tipo 'lógico' na condição do 'enquanto'.`);
        }

        return Promise.resolve();
    }

    /**
     * Verifica se variável existe, está inicializada e marca como usada
     */
    private verificarVariavel(variavel: Variavel): Promise<void> {
        const variavelEscopo = this.gerenciadorEscopos.buscar(variavel.simbolo.lexema);

        if (!variavelEscopo) {
            this.erro(
                variavel.simbolo,
                `Variável '${variavel.simbolo.lexema}' ainda não foi declarada até este ponto.`
            );
            return Promise.resolve();
        }

        // Marca como usada
        this.gerenciadorEscopos.marcarComoUsada(variavel.simbolo.lexema);

        // Verifica se foi inicializada
        if (!variavelEscopo.inicializada) {
            this.aviso(
                variavel.simbolo,
                `Variável '${variavel.simbolo.lexema}' pode não ter sido inicializada antes do uso.`
            );
        }

        return Promise.resolve();
    }

    /**
     * Verifica operação binária
     */
    private verificarBinario(binario: Binario): Promise<void> {
        this.verificarExistenciaConstruto(binario.direita);
        this.verificarExistenciaConstruto(binario.esquerda);
        this.verificarOperadorBinario(binario);
        return Promise.resolve();
    }

    /**
     * Verifica operador binário recursivamente
     */
    private verificarOperadorBinario(binario: Binario): void {
        if (binario.esquerda instanceof Binario) {
            this.verificarOperadorBinario(binario.esquerda);
        }

        if (binario.direita instanceof Binario) {
            this.verificarOperadorBinario(binario.direita);
        }

        const operadoresMatematicos = ['ADICAO', 'SUBTRACAO', 'MULTIPLICACAO', 'DIVISAO', 'MODULO'];
        if (operadoresMatematicos.includes(binario.operador.tipo)) {
            this.verificarTiposOperandos(binario);
        }

        if (binario.operador.tipo === 'DIVISAO') {
            this.verificarDivisaoPorZero(binario);
        }
    }

    /**
     * Verifica se os tipos dos operandos são compatíveis
     */
    private verificarTiposOperandos(binario: Binario): void {
        const tipoEsquerda = this.obterTipoExpressao(binario.esquerda);
        const tipoDireita = this.obterTipoExpressao(binario.direita);

        if (tipoEsquerda && tipoDireita && tipoEsquerda !== tipoDireita) {
            // Verificar se são tipos numéricos compatíveis
            const tiposNumericos = ['inteiro', 'número', 'real'];
            const ambosNumericos =
                tiposNumericos.includes(tipoEsquerda) && tiposNumericos.includes(tipoDireita);

            if (!ambosNumericos) {
                this.aviso(
                    binario.operador,
                    `Operação entre tipos diferentes: tipo esquerdo '${tipoEsquerda}' e tipo direito '${tipoDireita}'. O resultado será resolvido implicitamente.`
                );
            }
        }
    }

    /**
     * Verifica divisão por zero recursivamente
     */
    private verificarDivisaoPorZero(binario: Binario): void {
        const valorDireita = this.avaliarExpressaoConstante(binario.direita);

        if (valorDireita === 0) {
            this.erro(binario.operador, `Divisão por zero.`);
        }
    }

    /**
     * Tenta avaliar uma expressão em tempo de compilação para detectar valores constantes
     * Retorna o valor se puder ser determinado, ou null caso contrário
     */
    private avaliarExpressaoConstante(expressao: any): any {
        if (expressao instanceof Literal) {
            return expressao.valor;
        }

        if (expressao instanceof Variavel) {
            const variavel = this.gerenciadorEscopos.buscar(expressao.simbolo.lexema);
            if (!variavel) {
                return null;
            }

            if (variavel.imutavel && variavel.inicializada) {
                return variavel.valor;
            }

            if (variavel.inicializada && variavel.valor !== undefined) {
                return variavel.valor;
            }

            return null;
        }

        if (expressao instanceof Binario) {
            const esquerda = this.avaliarExpressaoConstante(expressao.esquerda);
            const direita = this.avaliarExpressaoConstante(expressao.direita);

            if (esquerda !== null && direita !== null) {
                return this.calcularOperacaoBinaria(expressao.operador.tipo, esquerda, direita);
            }
        }

        if (expressao instanceof Agrupamento) {
            return this.avaliarExpressaoConstante(expressao.expressao);
        }

        return null;
    }

    /**
     * Calcula o resultado de uma operação binária em tempo de compilação
     */
    private calcularOperacaoBinaria(operador: string, esquerda: any, direita: any): any {
        try {
            switch (operador) {
                case 'ADICAO':
                    return esquerda + direita;
                case 'SUBTRACAO':
                    return esquerda - direita;
                case 'MULTIPLICACAO':
                    return esquerda * direita;
                case 'DIVISAO':
                    return esquerda / direita;
                case 'MODULO':
                    return esquerda % direita;
                case 'MAIOR':
                    return esquerda > direita;
                case 'MAIOR_IGUAL':
                    return esquerda >= direita;
                case 'MENOR':
                    return esquerda < direita;
                case 'MENOR_IGUAL':
                    return esquerda <= direita;
                case 'IGUAL':
                    return esquerda === direita;
                case 'DIFERENTE':
                    return esquerda !== direita;
                default:
                    return null;
            }
        } catch (e) {
            return null;
        }
    }

    /**
     * Obtém o tipo de uma expressão (pode ser Literal, Variavel, ou Binario)
     */
    private obterTipoExpressao(expressao: any): string | null {
        if (expressao instanceof Literal) {
            return expressao.tipo;
        }

        if (expressao instanceof Variavel) {
            const variavel = this.gerenciadorEscopos.buscar(expressao.simbolo.lexema);
            return variavel?.tipo || null;
        }

        if (expressao instanceof Binario) {
            // Para binários, tentamos inferir o tipo baseado nos operandos
            return this.inferirTipoBinario(expressao);
        }

        if (expressao instanceof Agrupamento) {
            return this.obterTipoExpressao(expressao.expressao);
        }

        return null;
    }

    /**
     * Infere o tipo de resultado de uma operação binária
     */
    private inferirTipoBinario(binario: Binario): string | null {
        const tipoEsquerda = this.obterTipoExpressao(binario.esquerda);
        const tipoDireita = this.obterTipoExpressao(binario.direita);

        if (!tipoEsquerda || !tipoDireita) {
            return null;
        }

        const operadoresMatematicos = ['ADICAO', 'SUBTRACAO', 'MULTIPLICACAO', 'DIVISAO', 'MODULO'];
        const operadoresComparacao = [
            'MAIOR',
            'MAIOR_IGUAL',
            'MENOR',
            'MENOR_IGUAL',
            'IGUAL',
            'DIFERENTE',
        ];

        if (operadoresComparacao.includes(binario.operador.tipo)) {
            return 'lógico';
        }

        if (operadoresMatematicos.includes(binario.operador.tipo)) {
            const tiposNumericos = ['inteiro', 'número', 'real'];
            if (tiposNumericos.includes(tipoEsquerda) && tiposNumericos.includes(tipoDireita)) {
                // Se um dos lados é 'real', o resultado é 'real'
                if (tipoEsquerda === 'real' || tipoDireita === 'real') {
                    return 'real';
                }
                return 'número';
            }

            // Concatenação de textos
            if (tipoEsquerda === 'texto' || tipoDireita === 'texto') {
                return 'texto';
            }
        }

        return 'qualquer';
    }

    /**
     * Verifica existência de construto (variável ou binário)
     */
    private verificarExistenciaConstruto(construto: any): void {
        if (construto instanceof Variavel) {
            if (!this.gerenciadorEscopos.buscar(construto.simbolo.lexema)) {
                this.erro(
                    construto.simbolo,
                    `Variável ${construto.simbolo.lexema} ainda não foi declarada até este ponto.`
                );
                return;
            }
            this.gerenciadorEscopos.marcarComoUsada(construto.simbolo.lexema);
            return;
        }

        if (construto instanceof Binario) {
            this.verificarBinario(construto);
        }
    }

    /**
     * Verifica expressão lógica
     */
    private verificarLogico(logico: Logico): Promise<void> {
        this.verificarLadoLogico(logico.direita);
        this.verificarLadoLogico(logico.esquerda);
        return Promise.resolve();
    }

    /**
     * Verifica chamada de função
     */
    private verificarChamada(chamada: Chamada): Promise<void> {
        if (chamada.entidadeChamada instanceof Variavel) {
            let entidadeChamadaVariavel = chamada.entidadeChamada;
            if (!this.funcoes[entidadeChamadaVariavel.simbolo.lexema]) {
                this.erro(
                    entidadeChamadaVariavel.simbolo,
                    `Chamada da função '${entidadeChamadaVariavel.simbolo.lexema}' não existe.`
                );
            }
        }
        return Promise.resolve();
    }

    /**
     * Verifica lado de expressão lógica
     */
    private verificarLadoLogico(lado: any): void {
        if (lado instanceof Variavel) {
            let variavel = lado;
            this.verificarVariavelBinaria(variavel);
        }
    }

    /**
     * Verifica interpolações de texto e marca variáveis como usadas
     */
    protected verificarInterpolacaoTexto(texto: string, literal: Literal): void {
        // Regex para encontrar ${identificador}
        const regexInterpolacao = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
        let match;

        while ((match = regexInterpolacao.exec(texto)) !== null) {
            const nomeVariavel = match[1];

            // Verifica se a variável existe
            const variavel = this.gerenciadorEscopos.buscar(nomeVariavel);
            const funcao = this.funcoes[nomeVariavel];

            if (!variavel && !funcao) {
                this.erro(
                    {
                        lexema: nomeVariavel,
                        tipo: 'IDENTIFICADOR',
                        linha: literal.linha,
                        hashArquivo: literal.hashArquivo,
                        literal: null,
                    } as SimboloInterface,
                    `Variável ou função '${nomeVariavel}' usada em interpolação não existe.`
                );
            } else if (variavel) {
                // Marca como usada
                this.gerenciadorEscopos.marcarComoUsada(nomeVariavel);

                // Verifica se foi inicializada
                if (!variavel.inicializada) {
                    this.aviso(
                        {
                            lexema: nomeVariavel,
                            tipo: 'IDENTIFICADOR',
                            linha: literal.linha,
                            hashArquivo: literal.hashArquivo,
                            literal: null,
                        } as SimboloInterface,
                        `Variável '${nomeVariavel}' usada em interpolação pode não ter sido inicializada.`
                    );
                }
            }
        }
    }

    /**
     * Visita declaração escreva (print/write)
     */
    visitarDeclaracaoEscreva(declaracao: Escreva): Promise<void> {
        if (declaracao.argumentos.length === 0) {
            const { linha, hashArquivo } = declaracao;
            const simbolo: SimboloInterface = {
                literal: '',
                tipo: '',
                lexema: 'escreva',
                linha,
                hashArquivo,
            };
            this.erro(simbolo, `É preciso ter um ou mais parametros para 'escreva(...)'`);
            return Promise.resolve();
        }

        for (const argumento of declaracao.argumentos) {
            this.marcarVariaveisUsadasEmExpressao(argumento);

            if (argumento instanceof Literal && argumento.tipo === 'texto') {
                this.verificarInterpolacaoTexto(String(argumento.valor), argumento);
            }

            if (argumento instanceof Variavel) {
                const possivelVariavel = this.gerenciadorEscopos.buscar(argumento.simbolo.lexema);
                const possivelFuncao = this.funcoes[argumento.simbolo.lexema];

                if (!possivelVariavel && !possivelFuncao) {
                    this.erro(
                        argumento.simbolo,
                        `Variável ou função '${argumento.simbolo.lexema}' não existe.`
                    );
                    continue;
                }

                if (possivelVariavel && possivelVariavel.valor === undefined) {
                    this.aviso(
                        argumento.simbolo,
                        `Variável '${argumento.simbolo.lexema}' não foi inicializada.`
                    );
                }
            }
        }

        return Promise.resolve();
    }

    /**
     * Visita declaração de constante
     */
    visitarDeclaracaoConst(declaracao: Const): Promise<any> {
        this.verificarTipoAtribuido(declaracao);

        if (declaracao.inicializador) {
            this.marcarVariaveisUsadasEmExpressao(declaracao.inicializador);
        }

        const constanteCorrespondente = this.gerenciadorEscopos.buscarNoEscopoAtual(
            declaracao.simbolo.lexema
        );
        if (constanteCorrespondente) {
            this.erro(declaracao.simbolo, 'Declaração de constante já feita.');
            return Promise.resolve();
        }

        this.gerenciadorEscopos.declarar(declaracao.simbolo.lexema, {
            nome: declaracao.simbolo.lexema,
            tipo: declaracao.tipo || 'qualquer',
            imutavel: true,
            valor: declaracao.inicializador?.valor,
            inicializada: true,
            usada: false,
            hashArquivo: declaracao.simbolo.hashArquivo,
            linha: declaracao.simbolo.linha,
        });

        return Promise.resolve();
    }

    /**
     * Visita declaração de variável
     */
    visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        this.verificarTipoAtribuido(declaracao);

        if (declaracao.inicializador) {
            this.marcarVariaveisUsadasEmExpressao(declaracao.inicializador);
        }

        let valorInicializador: any = undefined;
        if (declaracao.inicializador) {
            if (declaracao.inicializador.hasOwnProperty('valor')) {
                valorInicializador = (declaracao.inicializador as any).valor;
            } else {
                valorInicializador = declaracao.inicializador;
            }
        }

        const variavel = {
            nome: declaracao.simbolo.lexema,
            tipo: declaracao.tipo || 'qualquer',
            imutavel: false,
            valor: valorInicializador,
            inicializada: declaracao.inicializador !== null && declaracao.inicializador !== undefined,
            usada: false,
            hashArquivo: declaracao.simbolo.hashArquivo,
            linha: declaracao.simbolo.linha,
        };

        const declaradaComSucesso = this.gerenciadorEscopos.declarar(
            declaracao.simbolo.lexema,
            variavel
        );

        if (!declaradaComSucesso) {
            const variavelExistente = this.gerenciadorEscopos.buscarNoEscopoAtual(
                declaracao.simbolo.lexema
            );
            this.aviso(
                declaracao.simbolo,
                `Variável '${declaracao.simbolo.lexema}' já foi declarada na linha ${variavelExistente?.linha}.`
            );
        }

        return Promise.resolve();
    }

    /**
     * Visita declaração de definição de função
     */
    visitarDeclaracaoDefinicaoFuncao(declaracao: FuncaoDeclaracao): Promise<any> {
        if (declaracao.funcao.tipo === undefined) {
            this.erro(declaracao.simbolo, `Declaração de retorno da função é inválido.`);
        }

        if (declaracao.funcao.parametros.length >= 255) {
            this.erro(declaracao.simbolo, 'Função não pode ter mais de 255 parâmetros.');
        }

        let tipoRetornoFuncao = declaracao.funcao.tipo;
        if (tipoRetornoFuncao) {
            if (!['vazio', 'qualquer'].includes(tipoRetornoFuncao)) {
                const todosOsCaminhosRetornam = this.todosOsCaminhosRetornam(
                    declaracao.funcao.corpo
                );
                if (!todosOsCaminhosRetornam) {
                    this.erro(
                        declaracao.simbolo,
                        `Função '${declaracao.simbolo.lexema}' deve retornar '${tipoRetornoFuncao}' em todos os caminhos de execução.`
                    );
                }
            }

            let funcaoContemRetorno = declaracao.funcao.corpo.find((c) => c instanceof Retorna);
            if (funcaoContemRetorno && (funcaoContemRetorno as Retorna).valor) {
                if (tipoRetornoFuncao === 'vazio') {
                    this.erro(declaracao.simbolo, `A função não pode ter nenhum tipo de retorno.`);
                } else {
                    const tipoValor = typeof (funcaoContemRetorno as any).valor.valor;
                    if (!['qualquer'].includes(tipoRetornoFuncao)) {
                        if (tipoValor === 'string' && tipoRetornoFuncao !== 'texto') {
                            this.erro(
                                declaracao.simbolo,
                                `Esperado retorno do tipo '${tipoRetornoFuncao}' dentro da função.`
                            );
                        }

                        if (
                            tipoValor === 'number' &&
                            !['inteiro', 'real', 'número'].includes(tipoRetornoFuncao)
                        ) {
                            this.erro(
                                declaracao.simbolo,
                                `Esperado retorno do tipo '${tipoRetornoFuncao}' dentro da função.`
                            );
                        }
                    }
                }
            }
        }

        this.funcoes[declaracao.simbolo.lexema] = {
            valor: declaracao.funcao,
        };

        return Promise.resolve();
    }

    /**
     * Visita expressão leia
     * Mapeia o formato de leitura para o tipo esperado
     * Nota: argumentos[0] = variável, argumentos[1] = formato
     */
    visitarExpressaoLeia(expressao: Leia): Promise<any> {
        const nomeVariavel = (expressao.argumentos[0] as Variavel).simbolo.lexema;

        // Verifica se a variável foi declarada
        if (!this.gerenciadorEscopos.buscar(nomeVariavel)) {
            this.diagnosticos.push({
                simbolo: (expressao.argumentos[0] as Variavel).simbolo,
                mensagem: `A variável ${nomeVariavel} não foi declarada.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
            return Promise.resolve();
        }

        // Marca a variável como usada (ela está sendo lida)
        this.gerenciadorEscopos.marcarComoUsada(nomeVariavel);

        const variavelEscopo = this.gerenciadorEscopos.buscar(
            (expressao.argumentos[0] as Variavel).simbolo.lexema
        );
        const tipoVariavelExpressao = variavelEscopo?.tipo;

        // Em BIRL, o analisador sintático já converte o formato para o tipo
        // Por exemplo: "%d" vira "número", "%s" vira "texto"
        const tipoEsperado = (expressao.argumentos[1] as any).valor;

        // Verifica compatibilidade de tipos numéricos
        // "numero" (sem acento) e "número" (com acento) são equivalentes
        const tiposNumericos = ['numero', 'número', 'inteiro', 'real', 'qualquer'];
        const tipoVariavelEhNumerico = tiposNumericos.includes(tipoVariavelExpressao || '');
        const tipoEsperadoEhNumerico = tiposNumericos.includes(tipoEsperado || '');

        // Se ambos são numéricos, aceita (permite compatibilidade entre "numero" e "número")
        if (tipoVariavelEhNumerico && tipoEsperadoEhNumerico) {
            return Promise.resolve();
        }

        // Para tipos não numéricos, precisa ser exatamente igual
        if (tipoVariavelExpressao !== tipoEsperado) {
            this.diagnosticos.push({
                simbolo: (expressao.argumentos[0] as Variavel).simbolo,
                mensagem: `A variável ${
                    (expressao.argumentos[0] as Variavel).simbolo.lexema
                } não é do tipo ${tipoEsperado}.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
        }

        return Promise.resolve();
    }

    /**
     * Visita expressão de variável
     */
    visitarExpressaoDeVariavel(expressao: Variavel): Promise<any> {
        if (expressao instanceof Variavel) {
            return this.verificarVariavel(expressao);
        }
        return Promise.resolve();
    }

    /**
     * Visita expressão retornar
     */
    visitarExpressaoRetornar(declaracao: Retorna): Promise<RetornoQuebra> {
        return Promise.resolve(null);
    }

    /**
     * Verifica variáveis não usadas
     */
    verificarVariaveisNaoUsadas(): void {
        const naoUsadas = this.gerenciadorEscopos.obterVariaveisNaoUsadas();

        for (let variavel of naoUsadas) {
            // Verifica se já existe um erro associado à variável
            const temErro = this.diagnosticos.some(
                (d) =>
                    d.severidade === DiagnosticoSeveridade.ERRO && d.simbolo.lexema === variavel.nome
            );

            // Se a variável já tem um erro associado, não emitir aviso de não usada
            if (temErro) {
                continue;
            }

            this.aviso(
                {
                    lexema: variavel.nome,
                    linha: variavel.linha,
                    tipo: variavel.tipo,
                    hashArquivo: variavel.hashArquivo,
                } as SimboloInterface,
                `Variável '${variavel.nome}' foi declarada mas nunca usada.`
            );
        }
    }

    /**
     * Analisa as declarações e retorna os diagnósticos
     */
    async analisar(declaracoes: Declaracao[]): Promise<RetornoAnalisadorSemantico> {
        // Inicializa o gerenciador de escopos
        this.gerenciadorEscopos = new GerenciadorEscopos();
        this.atual = 0;
        this.diagnosticos = [];

        while (this.atual < declaracoes.length) {
            await declaracoes[this.atual].aceitar(this);
            this.atual++;
        }

        // Verifica variáveis não usadas ao final
        this.verificarVariaveisNaoUsadas();

        return {
            diagnosticos: this.diagnosticos,
        } as RetornoAnalisadorSemantico;
    }
}
