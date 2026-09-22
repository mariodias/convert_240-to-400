# Conversor CNAB240 → CNAB400 Vórtx (310)

Converte arquivos de remessa CNAB240 no padrão FEBRABAN (segmentos P, Q e R) para o
layout CNAB400 da Vórtx (banco 310), versão *Remessa v1.1-oficial*.

A conversão roda inteiramente no navegador: nenhum arquivo é enviado a servidor.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Interface (upload, configuração, prévia campo a campo e download) |
| `conversor.js` | Lógica de conversão, usada pela página e pelos testes em Node |
| `teste/entrada.rem` | CNAB240 de exemplo com 5 títulos fictícios |
| `teste/saida_esperada.rem` | Saída esperada para o exemplo |
| `teste/teste.js` | Teste de regressão |

## Publicando no GitHub Pages

1. Crie um repositório e envie estes arquivos para a branch `main`, com o `index.html` na raiz.
2. Em **Settings → Pages**, em *Build and deployment*, escolha **Deploy from a branch**,
   branch `main`, pasta `/ (root)`, e salve.
3. Em alguns minutos o conversor fica disponível em `https://<usuario>.github.io/<repositorio>/`.

Se o repositório for de uma organização com Pages restrito, publique como página privada
(GitHub Enterprise) ou confirme com o time quem pode acessar o link.

## Testes

```bash
node teste/teste.js
```

Compara a conversão de `teste/entrada.rem` byte a byte com `teste/saida_esperada.rem`.
Rode sempre que alterar `conversor.js`.

## Regras de conversão

- **Conta do beneficiário (021–037):** informe a conta com dígito, por exemplo `12345678-9`.
  Contas Vórtx de 8 dígitos são gravadas como zero, carteira (3), agência (4), conta (8) e DV.
  Contas de até 7 dígitos seguem o layout original, com agência de 5 posições e conta de 7.
  A conta Grafeno do header (027–046) é opcional e, se vazia, recebe a mesma conta sem o dígito.
- **Agrupamento:** cada segmento P abre um título; Q (obrigatório) e R (opcional) são anexados a ele.
- **Ocorrências:** 01, 02, 04, 06 e 09 passam direto; 10 e 11 (sustar protesto) viram 19.
  Outros códigos de movimento geram erro.
- **Espécie:** de-para FEBRABAN → Vórtx; espécies sem equivalente viram 99 (Outros).
- **Juros:** valor/dia passa direto; taxa mensal é convertida para valor/dia (valor × taxa ÷ 30).
- **Multa:** percentual passa direto; valor fixo é convertido para percentual do valor do título.
  A data de multa do 240 é descartada.
- **Descontos:** desconto 1 vai para o registro 1; descontos 2 e 3 (segmento R) vão para o registro 2,
  junto com a mensagem 3 do R. Descontos percentuais são convertidos para valor.
- **Nosso número:** por padrão remove não-dígitos e zeros à esquerda do campo 038–057 do P.
  Como esse campo é específico do banco de origem, ajuste `extrairNossoNumero` na chamada de
  `converter` se o layout de origem incluir carteira ou DV. O DV é calculado em módulo 11 base 7
  com a carteira à esquerda.
- Toda conversão com perda gera um aviso na tela.

## Pontos a confirmar com a Vórtx

1. Registro 2: o campo 002–321 aparece com tamanho 393 (na prática são 320), e as datas dos
   descontos 2 e 3 têm 6 posições com conteúdo "DDMMAAAA". O conversor usa DDMMAA.
2. CPF do pagador (221–234): brancos à esquerda num campo numérico, conforme o layout.
3. Percentual de multa (067–070): assumido com 2 casas decimais (`0200` = 2%).
4. O registro 1 não tem bairro, cidade ou UF do pagador.
5. Conta de 8 dígitos: o layout prevê agência 5 + conta 7 em 025–036. O conversor usa agência 4 + conta 8
   nas mesmas 12 posições, mantendo o registro com 17 posições no campo 021–037.

Não são gerados os registros 3 (split) e 7 (sacador avalista com endereço).
