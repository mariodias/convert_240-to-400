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

- **Conta do beneficiário (021–037):** zero, carteira (3), agência (5) e conta (8), sem o DV da conta.
  Informe a conta só com os dígitos; se vier com DV (`12345678-9`), ele é descartado.
  A conta Grafeno do header (027–046) é opcional e, se vazia, recebe a mesma conta.
- **Pagador:** CPF e CNPJ com zeros à esquerda (CPF = `01` + 14 posições). O endereço recebe a rua
  e, quando cabe nas 40 posições, a cidade (`RUA X 100 - CIDADE`). O CEP é obrigatório.
- **Agrupamento:** cada segmento P abre um título; Q (obrigatório) e R (opcional) são anexados a ele.
- **Ocorrências:** 01, 02, 04, 06 e 09 passam direto; 10 e 11 (sustar protesto) viram 19.
  Outros códigos de movimento geram erro.
- **Espécie:** de-para FEBRABAN → Vórtx; espécies sem equivalente viram 99 (Outros).
- **Juros:** valor/dia passa direto; taxa mensal é convertida para valor/dia (valor × taxa ÷ 30).
- **Multa:** gravada com 1 casa decimal (`0020` = 2,0%). Percentuais do 240 com 2 casas são arredondados,
  com aviso; valor fixo é convertido para percentual do valor do título.
  A data de multa do 240 é descartada.
- **Descontos:** desconto 1 vai para o registro 1; descontos 2 e 3 (segmento R) vão para o registro 2,
  junto com a mensagem 3 do R. Descontos percentuais são convertidos para valor.
- **Nosso número:** por padrão remove não-dígitos e zeros à esquerda do campo 038–057 do P.
  Como esse campo é específico do banco de origem, ajuste `extrairNossoNumero` na chamada de
  `converter` se o layout de origem incluir carteira ou DV. O DV é calculado em módulo 11 base 7
  com a carteira à esquerda.
- Toda conversão com perda gera um aviso na tela.

## Definições confirmadas com a Vórtx

- Registro 1, 021–037: agência com 5 posições e conta com 8, sem DV.
- Registro 2: o campo 002–321 tem 320 posições (o PDF indica 393 por engano).
- Datas no formato DDMMAA, inclusive as dos descontos 2 e 3.
- Percentual de multa com 1 casa decimal.
- CPF do pagador com zeros à esquerda.
- Endereço: só rua e CEP (e cidade, se couber); apenas o CEP é obrigatório.

Não são gerados os registros 3 (split) e 7 (sacador avalista com endereço).
