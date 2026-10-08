// Gera teste/entrada_bradesco.rem (remessa CNAB240 Bradesco, layout 084/042) com dados fictícios
const fs = require("fs");
const path = require("path");
const { dvNossoNumeroBradesco } = require("../conversor.js");

const n = (v, t) => String(v).padStart(t, "0");
const a = (v, t) => String(v).padEnd(t, " ").slice(0, t);
const CARTEIRA = "09";
const CONTA = ["01234", "5", n("56789", 12), "0", " "].join(""); // agência, DV, conta, DV, DV ag/conta
const EMPRESA = a("EMPRESA TESTE BRADESCO LTDA", 30);

function registro(partes) {
  const l = partes.join("");
  if (l.length !== 240) throw new Error(`registro com ${l.length} posições: ${l.slice(0, 20)}`);
  return l;
}
const nossoNumero = (nn) => n(CARTEIRA, 3) + "00000" + n(nn, 11) + (Number(nn) ? dvNossoNumeroBradesco(CARTEIRA, nn) : "0");

let seq = 0;
const det = (seg, mov) => ["237", "0001", "3", n(++seq, 5), seg, " ", mov];

function P(t) {
  return registro([
    ...det("P", t.mov), CONTA, nossoNumero(t.nn), "1", "1", "2", "2", "2",
    a(t.seuNumero, 15), t.venc, n(t.valor, 15), "00000", " ", t.especie, "N", t.emissao,
    t.juros[0], t.juros[1], n(t.juros[2], 15),
    "0", "00000000", n(0, 15), n(0, 15), n(0, 15),
    a(t.controle, 25), "3", "00", "1", "059", "09", n(0, 10), " ",
  ]);
}
function Q(t) {
  return registro([
    ...det("Q", t.mov), t.pagador.tipo, n(t.pagador.doc, 15), a(t.pagador.nome, 40), a(t.pagador.rua, 40),
    a("BAIRRO TESTE", 15), t.pagador.cep, a("CIDADE TESTE", 15), "SP",
    "0", n(0, 15), a("", 40), "000", a("", 20), a("", 8),
  ]);
}
function R(t) {
  const [d2, msg] = t.r.desconto2 ? [["1", t.r.desconto2[0], n(t.r.desconto2[1], 15)], t.r.mensagem] : [["0", "00000000", n(0, 15)], ""];
  return registro([
    ...det("R", t.mov), ...d2, "0", "00000000", n(0, 15),
    t.r.multa[0], t.r.multa[1], n(t.r.multa[2], 15), a("", 10), a(msg, 40), a("", 40), a("", 20),
    "00000000", "000", "00000", " ", n(0, 12), " ", " ", "0", a("", 9),
  ]);
}

const titulos = [
  { mov: "01", nn: 1001, seuNumero: "000000001001", venc: "30102026", valor: 150000, especie: "02", emissao: "01102026",
    juros: ["1", "31102026", 50], controle: "CTRL-BRAD-0001",
    pagador: { tipo: "2", doc: "00000000000191", nome: "PAGADOR TESTE UM LTDA", rua: "RUA TESTE 100", cep: "01000000" },
    r: { multa: ["2", "31102026", 200] } },
  { mov: "01", nn: 2, seuNumero: "NF-2002", venc: "15112026", valor: 89990, especie: "17", emissao: "01102026",
    juros: ["2", "16112026", 100], controle: "CTRL-BRAD-0002",
    pagador: { tipo: "1", doc: "00000000191", nome: "PAGADOR TESTE DOIS", rua: "AVENIDA TESTE 2000", cep: "02000000" },
    r: { multa: ["0", "00000000", 0], desconto2: ["10112026", 1000], mensagem: "MENSAGEM DE TESTE BRADESCO" } },
  { mov: "01", nn: 0, seuNumero: "3003", venc: "05122026", valor: 25000, especie: "04", emissao: "01102026",
    juros: ["3", "00000000", 0], controle: "CTRL-BRAD-0003",
    pagador: { tipo: "1", doc: "00000000272", nome: "PAGADOR TESTE TRES", rua: "TRAVESSA TESTE 3", cep: "03000000" } },
  { mov: "02", nn: 1003, seuNumero: "000000001003", venc: "30092026", valor: 10000, especie: "02", emissao: "01092026",
    juros: ["3", "00000000", 0], controle: "CTRL-BRAD-0004" },
];

const linhas = [];
linhas.push(registro([
  "237", "0000", "0", a("", 9), "2", n("00000000000191", 14), n("1234567", 20), CONTA, EMPRESA,
  a("BRADESCO", 30), a("", 10), "1", "01102026", "093000", "000001", "084", "06250", a("", 20), a("", 20), a("", 29),
]));
linhas.push(registro([
  "237", "0001", "1", "R", "01", "  ", "042", " ", "2", n("00000000000191", 15), n("1234567", 20), CONTA, EMPRESA,
  a("", 40), a("", 40), n(42, 8), "01102026", "00000000", a("", 33),
]));
for (const t of titulos) {
  linhas.push(P(t));
  if (t.pagador) linhas.push(Q(t));
  if (t.r) linhas.push(R(t));
}
linhas.push(registro(["237", "0001", "5", a("", 9), n(seq + 2, 6), a("", 217)]));
linhas.push(registro(["237", "9999", "9", a("", 9), "000001", n(linhas.length + 1, 6), "000000", a("", 205)]));

fs.writeFileSync(path.join(__dirname, "entrada_bradesco.rem"), linhas.join("\r\n") + "\r\n", "latin1");
console.log(`entrada_bradesco.rem: ${linhas.length} registros`);
