import {
    Atribuir,
    Variavel,
} from '@designliquido/delegua/construtos';
import {
    Declaracao,
    Expressao,
    Leia,
    Retorna,
    Var
} from '@designliquido/delegua/declaracoes';
import { DiagnosticoAnalisadorSemantico, DiagnosticoSeveridade } from '@designliquido/delegua/interfaces/erros';
import { RetornoAnalisadorSemantico } from '@designliquido/delegua/interfaces/retornos/retorno-analisador-semantico';
import { RetornoQuebra } from '@designliquido/delegua/quebras';
import { AnalisadorSemanticoBase } from '@designliquido/delegua/analisador-semantico/analisador-semantico-base';
import { PilhaVariaveis } from '@designliquido/delegua/analisador-semantico/pilha-variaveis';

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
    variaveis: { [nomeVariavel: string]: VariavelHipoteticaBirlInterface };
    atual: number;
    diagnosticos: DiagnosticoAnalisadorSemantico[];

    constructor() {
        super();
        this.pilhaVariaveis = new PilhaVariaveis();
        this.variaveis = {};
        this.atual = 0;
        this.diagnosticos = [];
    }

    visitarExpressaoDeAtribuicao(expressao: Atribuir) {
        if (!this.variaveis.hasOwnProperty(expressao.simbolo.lexema)) {
            this.diagnosticos.push({
                simbolo: expressao.simbolo,
                mensagem: `A variável ${expressao.simbolo.lexema} não foi declarada.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
            return Promise.resolve();
        }

        if (this.variaveis[expressao.simbolo.lexema].imutavel) {
            this.diagnosticos.push({
                simbolo: expressao.simbolo,
                mensagem: `Constante ${expressao.simbolo.lexema} não pode ser modificada.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
            return Promise.resolve();
        }
    }

    visitarDeclaracaoDeExpressao(declaracao: Expressao) {
        return declaracao.expressao.aceitar(this);
    }

    visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        this.variaveis[declaracao.simbolo.lexema] = {
            imutavel: false,
            tipo: 'número',
        };

        return Promise.resolve();
    }

    visitarExpressaoLeia(expressao: Leia) {
        if (!this.variaveis.hasOwnProperty((expressao.argumentos[0] as Variavel).simbolo.lexema)) {
            this.diagnosticos.push({
                simbolo: (expressao.argumentos[0] as Variavel).simbolo,
                mensagem: `A variável ${(expressao.argumentos[0] as Variavel).simbolo.lexema} não foi declarada.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
            return Promise.resolve();
        }

        const tipoVariavelExpressão = this.variaveis[(expressao.argumentos[0] as Variavel).simbolo.lexema].tipo;
        const tipoVariavelArgumento = expressao.argumentos[1].valor;

        if (tipoVariavelExpressão !== tipoVariavelArgumento) {
            this.diagnosticos.push({
                simbolo: (expressao.argumentos[0] as Variavel).simbolo,
                mensagem: `A variável ${
                    (expressao.argumentos[0] as Variavel).simbolo.lexema
                } não é do tipo ${tipoVariavelArgumento}.`,
                hashArquivo: expressao.hashArquivo,
                linha: expressao.linha,
                severidade: DiagnosticoSeveridade.ERRO,
            });
        }

        return Promise.resolve();
    }

    visitarExpressaoRetornar(declaracao: Retorna): Promise<RetornoQuebra> {
        return Promise.resolve(null);
    }

    analisar(declaracoes: Declaracao[]): RetornoAnalisadorSemantico {
        this.variaveis = {};
        this.atual = 0;
        this.diagnosticos = [];

        while (this.atual < declaracoes.length) {
            declaracoes[this.atual].aceitar(this);
            this.atual++;
        }

        return {
            diagnosticos: this.diagnosticos,
        } as RetornoAnalisadorSemantico;
    }
}
