import { Construto, Leia, Literal } from '@designliquido/delegua/construtos';
import { Declaracao, Para, Retorna } from '@designliquido/delegua/declaracoes';
import { RetornoInterpretador } from '@designliquido/delegua/interfaces/retornos';
import { InterpretadorBaseComDepuracao } from '@designliquido/delegua/interpretador/depuracao';
import { InterpretadorInterface } from '@designliquido/delegua/interfaces';
import { RetornoQuebra } from '@designliquido/delegua/quebras';

import * as comum from './comum';

export class InterpretadorBirlComDepuracao extends InterpretadorBaseComDepuracao {
    constructor(diretorioBase: string, funcaoDeRetorno: Function = null, funcaoDeRetornoMesmaLinha: Function = null) {
        super(diretorioBase, funcaoDeRetorno, funcaoDeRetornoMesmaLinha);
    }

    async atribuirVariavel(
        interpretador: InterpretadorInterface,
        expressao: Construto,
        valor: any,
        tipo: string
    ): Promise<any> {
        return comum.atribuirVariavel(interpretador, expressao, valor, tipo);
    }

    async resolverQuantidadeDeInterpolacoes(expressao: Literal): Promise<RegExpMatchArray> {
        return comum.resolverQuantidadeDeInterpolacoes(expressao);
    }

    async verificarTipoDaInterpolacao(dados: { tipo: string; valor: any }): Promise<boolean> {
        return comum.verificarTipoDaInterpolacao(dados);
    }

    async substituirValor(stringOriginal: string, novoValor: any, simboloTipo: string): Promise<string> {
        return comum.substituirValor(stringOriginal, novoValor, simboloTipo);
    }

    /**
     * Execução da leitura de valores da entrada configurada no
     * início da aplicação.
     * @param expressao Expressão do tipo Leia
     * @returns Promise com o resultado da leitura.
     */
    async visitarExpressaoLeia(expressao: Leia): Promise<any> {
        await comum.visitarExpressaoLeia(this, expressao);
    }

    async visitarExpressaoLiteral(expressao: Literal): Promise<any> {
        return comum.visitarExpressaoLiteral(expressao);
    }

    async visitarDeclaracaoPara(declaracao: Para): Promise<any> {
        return comum.visitarDeclaracaoPara(this, declaracao);
    }

    /**
     * Ao executar um retorno, manter o valor retornado no Interpretador para
     * uso por linhas que foram executadas com o comando `próximo` do depurador.
     * @param declaracao Uma declaracao Retorna
     * @returns O resultado da execução da visita.
     */
    override async visitarExpressaoRetornar(declaracao: Retorna): Promise<RetornoQuebra> {
        let valor = null;
        if (declaracao.valor != null) valor = await this.avaliar(declaracao.valor);

        const retorno = new RetornoQuebra(valor);

        // O escopo atual é marcado como finalizado, para notificar a
        // instrução de que deve ser descartado.
        const escopoAtual = this.pilhaEscoposExecucao.topoDaPilha();
        escopoAtual.finalizado = true;

        // Acha o primeiro escopo de função.
        const escopoFuncao = this.pilhaEscoposExecucao.obterEscopoPorTipo('funcao');
        if (escopoFuncao && escopoFuncao.idChamada !== undefined) {
            escopoAtual.ambiente.resolucoesChamadas[escopoFuncao.idChamada] =
                retorno && retorno.hasOwnProperty('valor') ? retorno.valor : retorno;
        }

        return retorno;
    }

    async avaliarArgumentosEscreva(argumentos: Construto[]): Promise<string> {
        return comum.avaliarArgumentosEscreva(this, argumentos);
    }

    async interpretar(declaracoes: Declaracao[], manterAmbiente?: boolean): Promise<RetornoInterpretador> {
        return comum.interpretar(this, declaracoes, manterAmbiente);
    }
}
