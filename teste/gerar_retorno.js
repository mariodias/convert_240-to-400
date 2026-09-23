// Gera teste/retorno_vortx400.ret (retorno CNAB400 Vórtx) com dados fictícios
const fs = require("fs");
const path = require("path");
const { dvNossoNumero } = require("../conversor.js");

const linha = () => Array(400).fill(" ");
const put = (l, ini, v) => { [...v].forEach((c, i) => (l[ini - 1 + i] = c)); };
const n = (v, t) => String(v).padStart(t, "0");
let seq = 0;
const fim = (l) => { put(l, 395, n(++seq, 6)); return l.join(""); };

const linhas = [];
const h = linha();
put(h, 1, "02RETORNO01"); put(h, 12, "COBRANCA".padEnd(15)); put(h, 27, n("12345678", 20));
put(h, 47, "EMPRESA TESTE CNAB LTDA".padEnd(30)); put(h, 77, "310"); put(h, 80, "VORTX DTVM".padEnd(15));
put(h, 95, "230926"); put(h, 109, "00042"); put(h, 380, "230926");
linhas.push(fim(h));

const titulo = (o) => {
  const l = linha();
  const nn = n(o.nn, 11);
  put(l, 1, "1"); put(l, 2, "02"); put(l, 4, n(0, 14)); put(l, 21, "00210000112345678");
  put(l, 38, `CTRL-${o.seu}`.padEnd(25)); put(l, 71, nn + dvNossoNumero(21, nn));
  put(l, 83, n(0, 10)); put(l, 106, "000"); put(l, 109, o.oc); put(l, 111, o.dataOc || "230926");
  put(l, 117, o.seu.padEnd(10)); put(l, 147, o.venc); put(l, 153, n(o.valor, 13));
  put(l, 166, o.bancoCob || "000"); put(l, 169, o.agCob || "00000");
  put(l, 176, n(o.despesas || 0, 13)); put(l, 189, n(0, 13)); put(l, 202, n(0, 13)); put(l, 215, n(0, 13));
  put(l, 228, n(o.abatimento || 0, 13)); put(l, 241, n(o.desconto || 0, 13)); put(l, 254, n(o.pago || 0, 13));
  put(l, 267, n(o.juros || 0, 13)); put(l, 280, n(0, 13));
  if (o.motivoProtesto) put(l, 295, o.motivoProtesto);
  put(l, 296, o.dataCred || "000000"); put(l, 302, "006"); put(l, 319, (o.motivos || "00").padEnd(10, "0"));
  linhas.push(fim(l));
};

titulo({ oc: "02", nn: 101, seu: "TESTE-0001", venc: "301026", valor: 150000, despesas: 250 });
titulo({ oc: "06", nn: 102, seu: "TESTE-0002", venc: "151126", valor: 89990, pago: 91790, juros: 1800,
         bancoCob: "341", agCob: "01234", dataOc: "161126", dataCred: "171126" });
titulo({ oc: "03", nn: 0, seu: "TESTE-0003", venc: "051226", valor: 25000, motivos: "4847" });
titulo({ oc: "09", nn: 90, seu: "TESTE-0090", venc: "300926", valor: 10000, motivos: "10" });
titulo({ oc: "14", nn: 91, seu: "TESTE-0091", venc: "311226", valor: 20000 });
titulo({ oc: "15", nn: 103, seu: "TESTE-0004", venc: "101026", valor: 30000, pago: 29000, desconto: 1000,
         dataCred: "240926" });
titulo({ oc: "19", nn: 104, seu: "TESTE-0005", venc: "011026", valor: 40000, motivoProtesto: "D" });
titulo({ oc: "94", nn: 105, seu: "TESTE-0006", venc: "201226", valor: 50000 });

const sp = linha();
put(sp, 1, "3"); put(sp, 2, "0210000112345678".padEnd(16)); put(sp, 18, "000000001015"); put(sp, 30, "11");
linhas.push(fim(sp));

const t = linha();
put(t, 1, "9201310"); put(t, 18, n(8, 8)); put(t, 26, n(414990, 14));
linhas.push(fim(t));

fs.writeFileSync(path.join(__dirname, "retorno_vortx400.ret"), linhas.join("\r\n") + "\r\n");
console.log(`retorno_vortx400.ret: ${linhas.length} linhas`);
