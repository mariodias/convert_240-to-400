// Teste de regressão: node teste/teste.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { converter, decodificar, dvNossoNumero } = require("../conversor.js");

assert.strictEqual(dvNossoNumero(21, 1), "9");
assert.strictEqual(dvNossoNumero(21, 2), "7");

const entrada = decodificar(fs.readFileSync(path.join(__dirname, "entrada.rem")));
const res = converter(entrada, {
  contaGrafeno: "12345", carteira: "21", agencia: "1", conta: "999999", dvConta: "9", sequencial: "1",
});
const esperado = fs.readFileSync(path.join(__dirname, "saida_esperada.rem"), "latin1");
assert.strictEqual(res.conteudo, esperado, "saída diferente do arquivo esperado");
assert.strictEqual(res.nomeArquivo, "CG22092026empresates.rem");
assert.strictEqual(res.avisos.length, 5);
// conta Vórtx de 8 dígitos + DV (agência 4 + conta 8 em 021-037)
const r8 = converter(entrada, { carteira: "21", agencia: "0001", conta: "12345678-9", sequencial: "2" });
const l1 = r8.registros[1].linha;
assert.strictEqual(l1.slice(20, 37), "00210001123456789");
assert.strictEqual(r8.registros[0].linha.slice(26, 46), "00000000000012345678", "conta Grafeno padrão");
assert.strictEqual(r8.registros[1].campos.find((c) => c.campo === "Conta corrente").ini, 29);
// formato antigo continua igual, com DV junto ou separado
const { contaBeneficiario } = require("../conversor.js");
assert.deepStrictEqual(
  contaBeneficiario({ agencia: "1", conta: "999999-9" }).campos.map((c) => c[1]).join(""),
  "0000109999999"
);
assert.throws(() => converter(entrada, { carteira: "21", agencia: "12345", conta: "12345678-9", sequencial: "1" }), /4 posições/);
assert.throws(() => converter(entrada, { carteira: "21", agencia: "1", conta: "123456789-0", sequencial: "1" }), /máximo/);
assert.throws(() => converter(entrada, { carteira: "21", agencia: "1", conta: "12345678", sequencial: "1" }), /formato/);

console.log(`ok: ${res.registros.length} registros, ${res.avisos.length} avisos`);
