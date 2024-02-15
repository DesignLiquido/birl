# birl

Nossa implementação do dialeto BIRL, usando TypeScript. 

## Sobre este dialeto

Este dialeto tenta implementar da forma mais fidedigna possível todos os comportamentos de execução de BIRL como foi implementado em [https://birl-language.github.io]. Basicamente, o mecanismo dessa linguagem é traduzir todos os comandos para C, fazer o deploy em um servidor na Heroku e executar. O problema é que a Heroku deixou de ser gratuita há algum tempo, e por causa disso a ferramenta nunca mais funcionou. A ideia do dialeto é puramente preservação e didática.

Inicialmente, este dialeto foi implementado dentro do núcleo de Delégua, já que tínhamos a ideia de (talvez) aproveitar algumas das funcionalidades implementadas em Delégua. Com a incorporação de mais dialetos ao núcleo, a manutenção do monolito começou a trazer impactos ao núcleo como um todo, com instruções que sequer existem em um dialeto tendo que ser implementadas porque outro dialeto a possui. Portanto, este dialeto foi separado do núcleo de Delégua, mas ainda o utiliza como dependência. 

## Componentes implementados

Este dialeto implementa os seguintes componentes:

- **Lexador**: responsável pela análise léxica da linguagem: converte um texto em símbolos (_tokens_) que são utilizados na avaliação sintática;
- **Avaliador Sintático**: responsável por converter símbolos em estruturas de alto nível. Essas estruturas de alto nível podem ser usadas para execução de código, formatação de código, tradução do fonte em outra linguagem de programação e análise semântica;
- **Interpretador**: recebe estruturas de alto nível da avaliação sintática e as executa como instruções;
- **Analisador Semântico**: recebe estruturas de alto nível e verifica se a execução do código correspondente faz sentido ou não. O código de entrada pode estar perfeitamente escrito quanto ao léxico e sintaxe, mas podem haver problemas como variáveis que não existem, funções que retornam um tipo incorreto, execuções impossíveis como divisões por zero, entre outras heurísticas.

## Finalidade educacional

A finalidade educacional deste dialeto serve a dois grandes propósitos:

- Permitir a qualquer pessoa executar código em BIRL, independente de sistema operacional e dispositivo, e independente de plataformas como a Heroku;
- Possibilitar a alunos que estejam estudando disciplinas de ciência da computação ou tecnologia da informação, como compiladores, a entender como esses componentes funcionando, já que boa parte deles faz parte do currículo eletivo de diversas instituições de ensino pelo mundo. O material disponível para tal é farto na língua inglesa, mas não na língua portuguesa.

## Compatibilidade com JavaScript e Node.js

Este dialeto é distribuído como um pacote do [NPM](https://npmjs.com), e é compatível com qualquer versão de JavaScript e Node.js. O código é escrito em TypeScript, mas transpilado para JavaScript ES5, virtualmente compatível com 100% dos navegadores de internet disponíveis atualmente.

Este dialeto pode ser utilizado como base para construir outras aplicações, como _sites_ de internet, aplicativos para dispositivos móveis e até mesmo scripts executados por linha de comando. É também agregado ao [pacote de Delégua para Node.js](https://github.com/DesignLiquido/delegua-node), o que permite a execução de fontes por linha de comando.