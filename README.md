# Conversor CNAB Vórtx (310)

Converte, nos dois sentidos, arquivos de cobrança entre o CNAB240 FEBRABAN e o CNAB400 da Vórtx (banco 310):

- **Remessa:** CNAB240 (segmentos P, Q e R) → CNAB400 Vórtx, layout *Remessa v1.1-oficial*.
- **Retorno:** CNAB400 Vórtx, layout *Retorno v1.0* → CNAB240 (segmentos T e U).

A conversão roda inteiramente no navegador: nenhum arquivo é enviado a servidor.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Interface com abas de remessa e retorno (upload, configuração, prévia campo a campo e download) |
| `conversor.js` | Lógica das duas conversões, usada pela página e pelos testes em Node |
| `teste/entrada.rem` | Remessa CNAB240 de exemplo com 5 títulos fictícios |
| `teste/saida_esperada.rem` | Remessa CNAB400 esperada para o exemplo |
| `teste/retorno_vortx400.ret` | Retorno CNAB400 Vórtx de exemplo com 8 títulos fictícios e um split |
| `teste/retorno_esperado_240.ret` | Retorno CNAB240 esperado para o exemplo |
| `teste/gerar_retorno.js` | Gera o retorno de exemplo |
| `teste/teste.js` | Testes de regressão das duas conversões |

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

Compara as conversões de remessa e de retorno byte a byte com os arquivos esperados e
verifica as regras de cada campo.
Rode sempre que alterar `conversor.js`.

## Regras de conversão da remessa

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

## Regras de conversão do retorno

- **Ocorrências:** Vórtx → código de movimento retorno FEBRABAN.

  | Vórtx | FEBRABAN | Observação |
  |---|---|---|
  | 02, 03, 06, 09, 11, 12, 13, 14, 17, 19, 20, 23, 28, 29, 30 | mesmo código | |
  | 10 (baixa pelo banco) | 09 | |
  | 15 (liquidação em cartório) | 06 | motivo 08 (em cartório) |
  | 21 (acerto do controle do participante) | 41 | |
  | 24 (entrada rejeitada por CEP) | 03 | motivos mantidos |
  | 27 (baixa rejeitada), 32 (instrução rejeitada) | 26 | |
  | 33 (alteração de outros dados) | 27 | |
  | 36 (protestado) | 25 | |
  | 41 (devolvido pelo cartório) | 24 | |
  | 19 ou 20 com motivo D (posição 295) | 26 | |

  As ocorrências 18, 22, 40, 77, 78 e 94 não têm equivalente no 240: esses títulos ficam fora
  do arquivo, com aviso.
- **Segmento T:** nosso número (com ou sem DV, configurável), seu número, vencimento, valor,
  banco e agência cobradores, controle do participante, tarifa (despesas de cobrança) e motivos.
  O retorno da Vórtx não traz o pagador, então os campos de pagador vão zerados.
- **Segmento U:** juros de mora, desconto, abatimento, valor pago, outros créditos, data da
  ocorrência e data do crédito. O valor líquido é o valor pago menos as despesas de cobrança.
- **Motivos (319–328):** repassados sem alteração para o segmento T (214–223).
- **Split (registro 3):** ignorado, com aviso.
- O NSA do header e o número do retorno do lote vêm do número do aviso bancário (109–113).

### Pontos a confirmar no retorno

1. As tabelas de motivos da Vórtx e do FEBRABAN coincidem nos códigos mais comuns, mas não em todos.
   Os motivos são repassados sem tradução.
2. As versões de layout do header de arquivo (107) e de lote (060) podem precisar de ajuste conforme
   o ERP do cliente (`versaoArquivo` e `versaoLote` em `converterRetorno`).
3. O valor líquido considera apenas as despesas de cobrança informadas no próprio registro.

## Definições da remessa confirmadas com a Vórtx

- Registro 1, 021–037: agência com 5 posições e conta com 8, sem DV.
- Registro 2: o campo 002–321 tem 320 posições (o PDF indica 393 por engano).
- Datas no formato DDMMAA, inclusive as dos descontos 2 e 3.
- Percentual de multa com 1 casa decimal.
- CPF do pagador com zeros à esquerda.
- Endereço: só rua e CEP (e cidade, se couber); apenas o CEP é obrigatório.

Não são gerados os registros 3 (split) e 7 (sacador avalista com endereço).
