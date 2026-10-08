// Teste de regressão: node teste/teste.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { converter, converterRetorno, decodificar, dvNossoNumero, contaBeneficiario } = require("../conversor.js");

const cfg = { carteira: "21", agencia: "1", conta: "12345678", sequencial: "1" };
const entrada = decodificar(fs.readFileSync(path.join(__dirname, "entrada.rem")));
const res = converter(entrada, cfg);
const campo = (linha, ini, fim) => linha.slice(ini - 1, fim);

// DV do nosso número (exemplos do layout)
assert.strictEqual(dvNossoNumero(21, 1), "9");
assert.strictEqual(dvNossoNumero(21, 2), "7");

// arquivo completo, byte a byte
const esperado = fs.readFileSync(path.join(__dirname, "saida_esperada.rem"), "latin1");
assert.strictEqual(res.conteudo, esperado, "saída diferente do arquivo esperado");
assert.strictEqual(res.nomeArquivo, "CG22092026empresates.rem");
assert.strictEqual(res.avisos.length, 5);

const t1 = res.registros[1].linha;
// 021-037: zero + carteira + agência (5) + conta (8), sem DV
assert.strictEqual(campo(t1, 21, 37), "00210000112345678");
assert.strictEqual(campo(res.registros[0].linha, 27, 46), "00000000000012345678", "conta Grafeno padrão");
// DV da conta é descartado
assert.strictEqual(converter(entrada, { ...cfg, conta: "12345678-9" }).conteudo, res.conteudo);
// multa com 1 casa decimal (2% = 0020)
assert.strictEqual(campo(t1, 66, 70), "20020");
// CPF com zeros à esquerda
assert.strictEqual(campo(t1, 219, 234), "0100000000000191");
// rua + cidade quando cabe em 40 posições
assert.strictEqual(campo(t1, 275, 314).trim(), "RUA TESTE 100 - CIDADE TESTE");

// validações
assert.deepStrictEqual(contaBeneficiario({ agencia: "0001", conta: "999999" }).campos.map((c) => c[1]).join(""), "0000100999999");
assert.throws(() => converter(entrada, { ...cfg, agencia: "123456" }), /agência/);
assert.throws(() => converter(entrada, { ...cfg, conta: "123456789" }), /até 8 dígitos/);
const semCep = entrada.split("\r\n").map((l) => (l[13] === "Q" ? l.slice(0, 128) + "00000000" + l.slice(136) : l)).join("\r\n");
assert.throws(() => converter(semCep, cfg), /CEP do pagador obrigatório/);

console.log(`remessa ok: ${res.registros.length} registros, ${res.avisos.length} avisos`);

// ================================================================ RETORNO
const ret400 = decodificar(fs.readFileSync(path.join(__dirname, "retorno_vortx400.ret")));
const ret = converterRetorno(ret400, {});
const retEsperado = fs.readFileSync(path.join(__dirname, "retorno_esperado_240.ret"), "latin1");
assert.strictEqual(ret.conteudo, retEsperado, "retorno diferente do arquivo esperado");
assert.strictEqual(ret.nomeArquivo, "RET240_23092026_00042.ret");
assert.ok(ret.registros.every((r) => r.linha.length === 240));

const segs = ret.registros.filter((r) => r.tipo === "T" || r.tipo === "U");
const T = segs.filter((r) => r.tipo === "T").map((r) => r.linha);
const U = segs.filter((r) => r.tipo === "U").map((r) => r.linha);
assert.strictEqual(T.length, 7, "ocorrência 94 fica fora do arquivo");
assert.deepStrictEqual(T.map((l) => campo(l, 16, 17)), ["02", "06", "03", "09", "14", "06", "26"]);
// liquidação normal: juros, valor pago, datas
assert.strictEqual(campo(U[1], 18, 32), "000000000001800");
assert.strictEqual(campo(U[1], 78, 92), "000000000091790");
assert.strictEqual(campo(U[1], 138, 153), "1611202617112026");
// liquidação em cartório (15) vira 06 com motivo 08
assert.strictEqual(campo(T[5], 214, 215), "08");
// tarifa de registro na entrada confirmada e nosso número com DV
assert.strictEqual(campo(T[0], 199, 213), "000000000000250");
assert.strictEqual(campo(T[0], 38, 57), "00000000000000001015");
assert.strictEqual(campo(converterRetorno(ret400, { nossoNumeroComDv: false }).registros[2].linha, 38, 57), "00000000000000000101");
// trailers
const trailerLote = ret.registros[ret.registros.length - 2].linha;
assert.strictEqual(campo(trailerLote, 18, 23), "000016");
assert.strictEqual(campo(trailerLote, 24, 46), "00000700000000000364990");
assert.strictEqual(campo(ret.registros[ret.registros.length - 1].linha, 24, 29), "000018");
assert.strictEqual(ret.avisos.length, 3);
assert.throws(() => converterRetorno(res.conteudo, {}), /não é de retorno/);

console.log(`retorno ok: ${ret.registros.length} registros, ${ret.avisos.length} avisos`);

// ================================================================ BRADESCO
const { dvNossoNumeroBradesco } = require("../conversor.js");
// exemplos do manual Bradesco (carteira 19)
assert.strictEqual(dvNossoNumeroBradesco("19", "00000000002"), "8");
assert.strictEqual(dvNossoNumeroBradesco("19", "00000000001"), "P");
assert.strictEqual(dvNossoNumeroBradesco("19", "00000000006"), "0");

const cfgB = { layout240: "bradesco", carteira: "21", agencia: "1", conta: "12345678" };
const entradaB = decodificar(fs.readFileSync(path.join(__dirname, "entrada_bradesco.rem")));
const resB = converter(entradaB, cfgB);
assert.strictEqual(resB.conteudo, fs.readFileSync(path.join(__dirname, "saida_esperada_bradesco.rem"), "latin1"), "remessa Bradesco diferente do esperado");
assert.strictEqual(resB.sequencial, "42", "sequencial vem do header de lote quando não informado");
assert.strictEqual(converter(entradaB, { ...cfgB, sequencial: "7" }).sequencial, "7");
const regB = resB.registros.filter((r) => r.tipo === "1").map((r) => r.linha);
// nosso número Bradesco (046-056) vai direto, com DV Vórtx da carteira 21
assert.strictEqual(campo(regB[0], 71, 82), "000000010014");
assert.strictEqual(campo(regB[1], 71, 82), "000000000027", "DV 'P' do Bradesco não passa para o 400");
assert.strictEqual(campo(regB[2], 71, 82), "000000000000", "nosso número zerado: Grafeno gera");
// seu número numérico longo perde os zeros à esquerda
assert.strictEqual(campo(regB[0], 111, 120), "1001      ");
// baixa sem segmento Q
assert.strictEqual(campo(regB[3], 109, 110), "02");
assert.ok(resB.avisos.some((a) => /sem segmento Q/.test(a)));
// DV do 240 errado gera aviso
const dvErrado = entradaB.replace("00900000000000010017", "00900000000000010019");
assert.ok(converter(dvErrado, cfgB).avisos.some((a) => /DV do nosso número no 240/.test(a)));
// arquivo Bradesco lido como FEBRABAN genérico: o nosso número não cabe
assert.throws(() => converter(entradaB, { ...cfgB, layout240: "febraban" }), /excede 11 dígitos/);
console.log(`remessa Bradesco ok: ${resB.registros.length} registros, ${resB.avisos.length} avisos`);

const cfgRetB = { layout240: "bradesco", carteira240: "09", agencia240: "01234", dvAgencia: "5", conta240: "56789", dvConta: "0", convenio: "1234567" };
const retB = converterRetorno(ret400, cfgRetB);
assert.strictEqual(retB.conteudo, fs.readFileSync(path.join(__dirname, "retorno_esperado_bradesco.ret"), "latin1"), "retorno Bradesco diferente do esperado");
assert.strictEqual(retB.nomeArquivo, "CB230942.RET");
const hB = retB.registros[0].linha;
assert.strictEqual(campo(hB, 1, 3), "237");
assert.strictEqual(campo(hB, 33, 72), "000000000000012345670123450000000567890 ", "convênio numérico e conta do ERP");
assert.strictEqual(campo(hB, 164, 171), "08406250");
assert.strictEqual(campo(retB.registros[1].linha, 14, 16), "042");
const TB = retB.registros.filter((r) => r.tipo === "T").map((r) => r.linha);
// T 038-057: carteira (3) + zeros (5) + nosso número (11) + DV Bradesco
assert.strictEqual(campo(TB[0], 38, 57), "00900000000000001018");
assert.strictEqual(campo(TB[0], 38, 57).slice(-1), dvNossoNumeroBradesco("09", "00000000101"));
assert.throws(() => converterRetorno(ret400, { layout240: "bradesco" }), /carteira Bradesco/);
console.log(`retorno Bradesco ok: ${retB.registros.length} registros, ${retB.avisos.length} avisos`);
