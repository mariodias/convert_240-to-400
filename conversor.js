/*
 * Conversor de remessa CNAB240 (FEBRABAN, segmentos P/Q/R) para
 * CNAB400 Vórtx (banco 310), layout "Remessa v1.1-oficial".
 * Funciona no navegador (window.Vortx400) e no Node (require).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Vortx400 = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  class ConversaoError extends Error {}

  // ------------------------------------------------------------ formatação
  const Fmt = {
    num(valor, tam, campo = "?") {
      const s = String(valor ?? "").replace(/\D/g, "");
      if (s.length > tam) throw new ConversaoError(`${campo}: '${s}' excede ${tam} dígitos`);
      return s.padStart(tam, "0");
    },
    alfa(valor, tam, upcase = true) {
      let s = String(valor ?? "").normalize("NFKD").replace(/\p{M}/gu, "");
      s = s.replace(/[^\x20-\x7E]/g, " ");
      if (upcase) s = s.toUpperCase();
      return s.slice(0, tam).padEnd(tam, " ");
    },
    branco: (tam) => " ".repeat(tam),
    data6: (d) => (d ? d.dd + d.mm + d.aaaa.slice(2) : "000000"),
  };

  // --------------------------------------------------------- leitura do 240
  function decodificar(bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("iso-8859-1").decode(bytes);
    }
  }

  function linhasDe(texto) {
    return texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  }

  const f = (l, ini, fim) => l.slice(ini - 1, fim);
  const int = (l, ini, fim) => parseInt(f(l, ini, fim).replace(/\D/g, "") || "0", 10);

  function data8(l, ini, fim) {
    const s = f(l, ini, fim);
    if (s.trim() === "" || /^0+$/.test(s)) return null;
    const m = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
    const d = m && new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (!m || d.getUTCDate() !== +m[1] || d.getUTCMonth() !== +m[2] - 1)
      throw new ConversaoError(`data inválida '${s}' (pos ${ini}-${fim})`);
    return { dd: m[1], mm: m[2], aaaa: m[3] };
  }

  function hoje() {
    const d = new Date();
    return {
      dd: String(d.getDate()).padStart(2, "0"),
      mm: String(d.getMonth() + 1).padStart(2, "0"),
      aaaa: String(d.getFullYear()),
    };
  }

  // ---------------------------------------------------------------- de-paras
  const OCORRENCIAS = { "01": "01", "02": "02", "04": "04", "06": "06", "09": "09", "10": "19", "11": "19" };
  const ESPECIES = {
    "02": "01", "03": "01", "04": "12", "05": "12", "12": "02", "13": "02",
    "16": "03", "17": "05", "07": "10", "19": "11", "31": "31", "32": "32",
  };

  // Módulo 11 base 7, carteira (2 dígitos) à esquerda; resto 0 ou 10/11 => 0
  function dvNossoNumero(carteira, nn) {
    const base = String(carteira).padStart(2, "0").slice(-2) + String(nn).padStart(11, "0");
    let soma = 0;
    [...base].reverse().forEach((d, i) => (soma += +d * (2 + (i % 6))));
    const resto = soma % 11;
    if (resto === 0) return "0";
    const dv = 11 - resto;
    return dv >= 10 ? "0" : String(dv);
  }

  // Conta do beneficiário (registro 1, 025-036): agência com 5 posições e
  // conta com 8, sem DV. Aceita "12345678" ou "12345678-9" (o DV é descartado).
  function contaBeneficiario(cfg) {
    const bruto = String(cfg.conta ?? "").replace(/[\s.]/g, "");
    const m = /^(\d+)(?:-[0-9Xx])?$/.exec(bruto);
    if (!m) throw new ConversaoError(`conta '${cfg.conta}' inválida: informe só os dígitos, sem o DV`);
    const conta = m[1].replace(/^0+(?=\d)/, "");
    if (conta.length > 8)
      throw new ConversaoError(`conta '${m[1]}' tem ${conta.length} dígitos; informe a conta com até 8 dígitos, sem o DV`);

    const agencia = String(cfg.agencia ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!agencia) throw new ConversaoError("agência obrigatória");

    return { numero: conta, campos: [
      ["Agência do beneficiário", Fmt.num(agencia, 5, "agência")],
      ["Conta corrente (sem DV)", Fmt.num(conta, 8, "conta")],
    ] };
  }

  // ---------------------------------------------------------------- registros
  // Cada registro é uma lista de [campo, valor]; posições derivam da ordem.
  function fechar(campos, seq) {
    const todos = [...campos, ["Número sequencial do registro", Fmt.num(seq, 6)]];
    let pos = 1;
    const mapa = todos.map(([campo, valor]) => {
      const item = { campo, valor, ini: pos, fim: pos + valor.length - 1 };
      pos += valor.length;
      return item;
    });
    const linha = mapa.map((c) => c.valor).join("");
    if (linha.length !== 400) throw new ConversaoError(`registro ${seq} com ${linha.length} posições`);
    return { tipo: linha[0], linha, campos: mapa };
  }

  function converter(texto, configEntrada) {
    const cfg = Object.assign(
      {
        nossoNumero: "manter",
        bairroNaMensagem: false,
        extrairNossoNumero: (campo) => campo.replace(/\D/g, "").replace(/^0+/, ""),
      },
      configEntrada
    );
    for (const k of ["carteira", "agencia", "conta", "sequencial"]) {
      if (cfg[k] === undefined || cfg[k] === null || String(cfg[k]).trim() === "")
        throw new ConversaoError(`configuração obrigatória ausente: ${k}`);
    }
    const avisos = [];
    const aviso = (m) => avisos.push(m);
    const beneficiario = contaBeneficiario(cfg);
    // Header 027-046: conta Grafeno sem dígito; por padrão, a mesma conta do beneficiário
    const contaGrafeno = String(cfg.contaGrafeno ?? "").trim() || beneficiario.numero;

    // --- agrupamento P+Q(+R)
    let header = null;
    const titulos = [];
    let atual = null;
    linhasDe(texto).forEach((original, i) => {
      const n = i + 1;
      let l = original;
      if (l.length !== 240) {
        aviso(`linha ${n}: ${l.length} posições (esperado 240), completada com brancos`);
        l = l.padEnd(240, " ").slice(0, 240);
      }
      const tipo = f(l, 8, 8);
      if (tipo === "0") {
        if (f(l, 143, 143) !== "1") throw new ConversaoError(`linha ${n}: header não é de remessa`);
        header = l;
      } else if (tipo === "3") {
        const seg = f(l, 14, 14);
        if (seg === "P") titulos.push((atual = { p: l, linhaP: n }));
        else if (seg === "Q" || seg === "R") {
          const k = seg.toLowerCase();
          if (!atual) throw new ConversaoError(`linha ${n}: segmento ${seg} sem P anterior`);
          if (atual[k]) throw new ConversaoError(`linha ${n}: segmento ${seg} duplicado`);
          atual[k] = l;
        } else aviso(`linha ${n}: segmento ${seg} ignorado`);
      }
    });
    if (!header) throw new ConversaoError("header de arquivo (tipo 0) não encontrado");
    titulos.forEach((t) => {
      if (!t.q) throw new ConversaoError(`título da linha ${t.linhaP} sem segmento Q`);
    });

    // --- regras de campo
    function nossoNumero(p, ocorrencia, ref) {
      if (cfg.nossoNumero === "grafeno" && ocorrencia === "01") return "0".repeat(11);
      let nn = String(cfg.extrairNossoNumero(f(p, 38, 57)));
      if (nn.length > 11) throw new ConversaoError(`${ref}: nosso número '${nn}' excede 11 dígitos`);
      nn = nn.padStart(11, "0");
      if (Number(nn) > 90000000000 && ocorrencia === "01")
        throw new ConversaoError(`${ref}: nosso número ${nn} está na faixa reservada à Grafeno`);
      return nn;
    }

    function moraDia(p, valor, ref) {
      const codigo = f(p, 118, 118);
      const taxa = int(p, 127, 141);
      if (codigo === "1") return taxa;
      if (codigo === "2") {
        const v = Math.round((valor * taxa) / 100 / 100 / 30);
        aviso(`${ref}: juros de taxa mensal convertidos para valor/dia (${v} centavos)`);
        return v;
      }
      if (["3", "0", " "].includes(codigo)) return 0;
      aviso(`${ref}: código de juros ${codigo} não suportado, enviado sem mora`);
      return 0;
    }

    function multa(t, valor, ref) {
      if (!t.r) return ["0", 0];
      const codigo = f(t.r, 66, 66);
      const v = int(t.r, 75, 89);
      let res = ["0", 0];
      // 240: percentual com 2 casas decimais; Vórtx: 1 casa (0020 = 2,0%)
      if (codigo === "2") {
        const perc = Math.round(v / 10);
        if (v % 10) aviso(`${ref}: multa de ${v / 100}% arredondada para ${perc / 10}% (1 casa decimal)`);
        res = ["2", perc];
      } else if (codigo === "1") {
        const perc = valor === 0 ? 0 : Math.round((v * 1000) / valor);
        aviso(`${ref}: multa em valor fixo convertida para percentual (${perc / 10}%)`);
        res = ["2", perc];
      }
      if ((codigo === "1" || codigo === "2") && data8(t.r, 67, 74))
        aviso(`${ref}: data de multa do 240 ignorada (400 Vórtx não tem esse campo)`);
      return res;
    }

    function desconto(codigo, data, v, valor, nome, ref) {
      if (codigo === "1") return [data, v];
      if (codigo === "2") return [data, Math.round((valor * v) / 10000)];
      if (codigo === "0" || codigo === " ") return [null, 0];
      aviso(`${ref}: ${nome} com código ${codigo} não suportado, ignorado`);
      return [null, 0];
    }

    function inscricaoPagador(q, ref) {
      const doc = f(q, 19, 33).replace(/\D/g, "");
      const tipo = f(q, 18, 18);
      if (tipo === "1") return ["01", doc.slice(-11).padStart(14, "0")];
      if (tipo === "2") return ["02", doc.slice(-14).padStart(14, "0")];
      throw new ConversaoError(`${ref}: tipo de inscrição do pagador obrigatório`);
    }

    function sacadorAvalista(q) {
      const doc = f(q, 155, 169).replace(/\D/g, "");
      const nome = f(q, 170, 209).trim();
      const tipo = f(q, 154, 154);
      let codigo = null;
      if (tipo === "2") codigo = "0" + doc.slice(-14).padStart(14, "0");
      else if (tipo === "1") {
        const cpf = doc.slice(-11).padStart(11, "0");
        codigo = cpf.slice(0, 9) + "0000" + cpf.slice(9, 11);
      }
      return codigo ? codigo + Fmt.alfa(nome, 45) : Fmt.branco(60);
    }

    // --- montagem
    const dataArquivo = data8(header, 144, 151) || hoje();
    const registros = [];

    registros.push([
      ["Identificação do registro", "0"],
      ["Identificação do arquivo remessa", "1"],
      ["Literal remessa", "REMESSA"],
      ["Código do serviço", "01"],
      ["Literal do serviço", Fmt.alfa("COBRANCA", 15)],
      ["Número da conta Grafeno", Fmt.num(contaGrafeno, 20, "conta Grafeno")],
      ["Nome da empresa", Fmt.alfa(f(header, 73, 102).trim(), 30)],
      ["Número do banco", "310"],
      ["Nome do banco", Fmt.alfa("VORTX DTVM", 15)],
      ["Data de gravação", Fmt.data6(dataArquivo)],
      ["Não utilizado", Fmt.branco(8)],
      ["Identificação do sistema", "MX"],
      ["Sequencial de remessa", Fmt.num(cfg.sequencial, 7, "sequencial remessa")],
      ["Não utilizado", Fmt.branco(277)],
    ]);

    for (const t of titulos) {
      const { p, q } = t;
      const ref = `título linha ${t.linhaP}`;
      const valor = int(p, 86, 100);
      const ocorrencia = OCORRENCIAS[f(p, 16, 17)];
      if (!ocorrencia)
        throw new ConversaoError(`${ref}: código de movimento ${f(p, 16, 17)} sem equivalente no 400 Vórtx`);

      const nn = nossoNumero(p, ocorrencia, ref);
      const [multaFlag, multaPerc] = multa(t, valor, ref);
      const [descData, descValor] = desconto(f(p, 142, 142), data8(p, 143, 150), int(p, 151, 165), valor, "desconto 1", ref);

      const seuNumero = f(p, 63, 77).trim();
      if (seuNumero.length > 10) aviso(`${ref}: seu número '${seuNumero}' truncado para 10 posições`);

      let especie = ESPECIES[f(p, 107, 108)];
      if (!especie) {
        aviso(`${ref}: espécie ${f(p, 107, 108)} mapeada para 99 (Outros)`);
        especie = "99";
      }
      const [tipoInsc, insc] = inscricaoPagador(q, ref);
      if (int(q, 129, 136) === 0) throw new ConversaoError(`${ref}: CEP do pagador obrigatório`);
      const rua = f(q, 74, 113).trim();
      const cidade = f(q, 137, 151).trim();
      const comCidade = rua && cidade ? `${rua} - ${cidade}` : rua || cidade;
      const endereco = comCidade.length <= 40 ? comCidade : rua;
      const sac = sacadorAvalista(q);

      registros.push([
        ["Identificação do registro", "1"],
        ["Não utilizado", Fmt.branco(19)],
        ["Zero", "0"],
        ["Carteira", Fmt.num(cfg.carteira, 3, "carteira")],
        ...beneficiario.campos,
        ["Número de controle do participante", Fmt.alfa(f(p, 196, 220).trim(), 25)],
        ["Código do banco", "310"],
        ["Campo de multa", multaFlag],
        ["Percentual de multa", Fmt.num(multaPerc, 4, "% multa")],
        ["Nosso número", nn],
        ["Dígito do nosso número", dvNossoNumero(cfg.carteira, nn)],
        ["Desconto por dia", Fmt.num(0, 10)],
        ["Não utilizado", Fmt.branco(14)],
        ["Quantidade de pagamentos", "01"],
        ["Identificação da ocorrência", ocorrencia],
        ["Número do documento (seu número)", Fmt.alfa(seuNumero, 10)],
        ["Data de vencimento", Fmt.data6(data8(p, 78, 85))],
        ["Valor do título", Fmt.num(valor, 13, "valor do título")],
        ["Banco encarregado", "000"],
        ["Agência depositária", "00000"],
        ["Espécie do título", especie],
        ["Identificação", "N"],
        ["Data de emissão", Fmt.data6(data8(p, 110, 117))],
        ["Não utilizado", Fmt.branco(4)],
        ["Mora por dia de atraso", Fmt.num(moraDia(p, valor, ref), 13, "mora")],
        ["Data limite do desconto", Fmt.data6(descData)],
        ["Valor do desconto", Fmt.num(descValor, 13, "desconto")],
        ["Valor do IOF", Fmt.num(int(p, 166, 180), 13, "IOF")],
        ["Valor do abatimento", Fmt.num(int(p, 181, 195), 13, "abatimento")],
        ["Tipo de inscrição do pagador", tipoInsc],
        ["Inscrição do pagador", insc],
        ["Nome do pagador", Fmt.alfa(f(q, 34, 73).trim(), 40)],
        ["Endereço do pagador", Fmt.alfa(endereco, 40)],
        ["Mensagem", Fmt.alfa(cfg.bairroNaMensagem ? f(q, 114, 128).trim() : "", 12)],
        ["CEP", Fmt.num(f(q, 129, 133), 5, "CEP")],
        ["Sufixo do CEP", Fmt.num(f(q, 134, 136), 3, "sufixo CEP")],
        ["Sacador avalista (documento)", sac.slice(0, 15)],
        ["Sacador avalista (nome)", sac.slice(15)],
      ]);

      if (t.r) {
        const r = t.r;
        const [d2Data, d2Valor] = desconto(f(r, 18, 18), data8(r, 19, 26), int(r, 27, 41), valor, "desconto 2", ref);
        const [d3Data, d3Valor] = desconto(f(r, 42, 42), data8(r, 43, 50), int(r, 51, 65), valor, "desconto 3", ref);
        const mensagem = f(r, 100, 139).trim();
        if (d2Valor || d3Valor || mensagem) {
          registros.push([
            ["Identificação do registro", "2"],
            ["E-mail do pagador ou mensagem", Fmt.alfa(mensagem, 320, false)],
            ["Data limite do desconto 2", Fmt.data6(d2Data)],
            ["Valor do desconto 2", Fmt.num(d2Valor, 13, "desconto 2")],
            ["Data limite do desconto 3", Fmt.data6(d3Data)],
            ["Valor do desconto 3", Fmt.num(d3Valor, 13, "desconto 3")],
            ["Não utilizado", Fmt.branco(35)],
          ]);
        }
      }
    }

    registros.push([
      ["Identificação do registro", "9"],
      ["Branco", Fmt.branco(393)],
    ]);

    const saida = registros.map((campos, i) => fechar(campos, i + 1));
    const razao = Fmt.alfa(f(header, 73, 102), 30, false).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
    const nomeArquivo = `CG${dataArquivo.dd}${dataArquivo.mm}${dataArquivo.aaaa}${razao}.rem`;

    return {
      registros: saida,
      conteudo: saida.map((r) => r.linha).join("\r\n") + "\r\n",
      nomeArquivo,
      avisos,
      totalTitulos: titulos.length,
    };
  }

  return { converter, decodificar, dvNossoNumero, contaBeneficiario, ConversaoError };
});
