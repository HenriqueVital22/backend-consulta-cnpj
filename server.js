const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const MAX_CNPJS_POR_LOTE = 50;
const INTERVALO_ENTRE_CONSULTAS = 1000;

// ======================================================
// FUNÇÃO PARA AGUARDAR
// ======================================================

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================
// LIMPA CNPJ
// ======================================================

function limparCNPJ(cnpj) {
  return String(cnpj || "").replace(/\D/g, "");
}

// ======================================================
// CONSULTA CNPJá
// ======================================================

async function consultarCNPJA(cnpj) {

  const url =
    "https://open.cnpja.com/office/" +
    cnpj +
    "?simples=true";

  try {

    const resposta = await fetch(url, {
      method: "GET"
    });

    const status = resposta.status;

    // --------------------------------------------------
    // LIMITE DA API
    // --------------------------------------------------

    if (status === 429) {

      return {
        cnpj: cnpj,
        resultado: "LIMITE API",
        codigo: 429
      };
    }

    // --------------------------------------------------
    // OUTROS ERROS
    // --------------------------------------------------

    if (status !== 200) {

      return {
        cnpj: cnpj,
        resultado: "ERRO API: " + status,
        codigo: status
      };
    }

    // --------------------------------------------------
    // CONVERTE RESPOSTA
    // --------------------------------------------------

    const dados = await resposta.json();

    // --------------------------------------------------
    // VERIFICA SIMPLES
    // --------------------------------------------------

    if (
      dados.company &&
      dados.company.simples
    ) {

      const optante =
        dados.company.simples.optant;

      if (optante === true) {

        return {
          cnpj: cnpj,
          resultado: "OPTANTE"
        };
      }

      if (optante === false) {

        return {
          cnpj: cnpj,
          resultado: "NÃO OPTANTE"
        };
      }
    }

    return {
      cnpj: cnpj,
      resultado: "NÃO IDENTIFICADO"
    };

  } catch (erro) {

    return {
      cnpj: cnpj,
      resultado: "ERRO",
      detalhe: erro.message
    };
  }
}

// ======================================================
// ROTA PRINCIPAL
// ======================================================

app.post("/consultar", async (req, res) => {

  try {

    const lista = req.body.cnpjs;

    // --------------------------------------------------
    // VERIFICA SE RECEBEU ARRAY
    // --------------------------------------------------

    if (!Array.isArray(lista)) {

      return res.status(400).json({
        sucesso: false,
        erro: "Envie os CNPJs em um array chamado cnpjs."
      });
    }

    // --------------------------------------------------
    // LIMITE DE 50
    // --------------------------------------------------

    if (lista.length > MAX_CNPJS_POR_LOTE) {

      return res.status(400).json({
        sucesso: false,
        erro: "O limite é de 50 CNPJs por lote."
      });
    }

    // --------------------------------------------------
    // REMOVE CNPJs VAZIOS
    // --------------------------------------------------

    const cnpjs = lista
      .map(limparCNPJ)
      .filter(cnpj => cnpj !== "");

    // --------------------------------------------------
    // RESULTADOS
    // --------------------------------------------------

    const resultados = [];

    // --------------------------------------------------
    // PROCESSAMENTO
    // --------------------------------------------------

    for (let i = 0; i < cnpjs.length; i++) {

      const cnpj = cnpjs[i];

      console.log(
        `Consultando ${i + 1}/${cnpjs.length}: ${cnpj}`
      );

      // -----------------------------------------------
      // VALIDA CNPJ
      // -----------------------------------------------

      if (cnpj.length !== 14) {

        resultados.push({
          cnpj: cnpj,
          resultado: "CNPJ INVÁLIDO"
        });

      } else {

        const resultado =
          await consultarCNPJA(cnpj);

        resultados.push(resultado);
      }

      // -----------------------------------------------
      // AGUARDA 1 SEGUNDO
      // -----------------------------------------------

      if (i < cnpjs.length - 1) {

        await esperar(
          INTERVALO_ENTRE_CONSULTAS
        );
      }
    }

    // --------------------------------------------------
    // RETORNA RESULTADOS
    // --------------------------------------------------

    return res.json({
      sucesso: true,
      quantidade: resultados.length,
      resultados: resultados
    });

  } catch (erro) {

    console.error(erro);

    return res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }

});

// ======================================================
// ROTA DE TESTE
// ======================================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    sistema: "Backend Consulta CNPJ",
    limitePorLote: MAX_CNPJS_POR_LOTE,
    intervaloEntreConsultas: "1 segundo"
  });

});

// ======================================================
// INICIA SERVIDOR
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `Servidor rodando na porta ${PORT}`
  );

});