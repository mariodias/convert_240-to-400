// Teste de regressão: node teste/teste.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { converter, decodificar, dvNossoNumero, contaBeneficiario } = require("../conversor.js");

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

console.log(`ok: ${res.registros.length} registros, ${res.avisos.length} avisos`);
