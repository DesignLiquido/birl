import { AvaliadorSintaticoBirl, LexadorBirl } from "../fontes";
import { InterpretadorBirlComDepuracao } from "../fontes/interpretador";

describe('Interpretador com Depuração (BIRL)', () => {
    let lexador: LexadorBirl;
    let avaliadorSintatico: AvaliadorSintaticoBirl;
    let interpretador: InterpretadorBirlComDepuracao;

    describe('interpretar()', () => {
        beforeEach(() => {
            lexador = new LexadorBirl();
            avaliadorSintatico = new AvaliadorSintaticoBirl();
        });

        describe('Sem pontos de parada', () => {
            let _saidas: string[] = [];
            const funcaoSaida = (texto: string) => {
                _saidas.push(texto);
            }

            beforeEach(() => {
                interpretador = new InterpretadorBirlComDepuracao(
                    process.cwd(),
                    funcaoSaida,
                    funcaoSaida
                );
            });

            it('Trivial', async () => {
                const retornoLexador = lexador.mapear([
                    'HORA DO SHOW \n',
                    '   CE QUER VER ESSA PORRA? ("Hello, World! Porra!\n"); \n',
                    '   BORA CUMPADE? 0; \n',
                    'BIRL \n',
                ], -1);
                const retornoAvaliadorSintatico = await avaliadorSintatico.analisar(retornoLexador, -1);

                let execucaoFinalizada: boolean = false;
                interpretador.finalizacaoDaExecucao = () => {
                    execucaoFinalizada = true;
                }

                interpretador.prepararParaDepuracao(retornoAvaliadorSintatico.declaracoes);
                await interpretador.instrucaoContinuarInterpretacao();

                expect(interpretador.pontoDeParadaAtivo).toBe(false);
                expect(execucaoFinalizada).toBe(true);
                expect(_saidas).toHaveLength(1);
                expect(_saidas[0]).toContain("Hello, World! Porra!");
            });
        });
    });
});
