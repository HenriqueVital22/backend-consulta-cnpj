const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const CNPJA_API_KEY = process.env.CNPJA_API_KEY;


// ======================================================
// LIMPA CNPJ
// ======================================================

function limparCNPJ(cnpj) {

  return String(cnpj || "")
    .replace(/\D/g, "");
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

    const resposta =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "Authorization":
              "Bearer " + CNPJA_API_KEY
          }
        }
      );


    const status =
      resposta.status;


    console.log(
      `CNPJ ${cnpj} - Status API: ${status}`
    );


    // ==================================================
    // LIMITE DA API
    // ==================================================

    if (status === 429) {

      return {
        resultado: "LIMITE API",
        codigo: 429
      };
    }


    // ==================================================
    // OUTROS ERROS
    // ==================================================

    if (status !== 200) {

      return {
        resultado: "ERRO API: " + status,
        codigo: status
      };
    }


    // ==================================================
    // CONVERTE RESPOSTA
    // ==================================================

    const dados =
      await resposta.json();


    // ==================================================
    // VERIFICA SIMPLES NACIONAL
    // ==================================================

    if (
      dados.company &&
      dados.company.simples
    ) {

      const optante =
        dados.company.simples.optant;


      if (optante === true) {

        return {
          resultado: "OPTANTE"
        };
      }


      if (optante === false) {

        return {
          resultado: "NÃO OPTANTE"
        };
      }
    }


    return {
      resultado: "NÃO IDENTIFICADO"
    };


  } catch (erro) {

    console.error(
      `Erro no CNPJ ${cnpj}:`,
      erro.message
    );


    return {
      resultado: "ERRO",
      detalhe: erro.message
    };
  }
}


// ======================================================
// ROTA PARA CONSULTAR 1 CNPJ
// ======================================================

app.post("/consultar", async (req, res) => {

  try {

    const cnpjRecebido =
      req.body.cnpj;


    // ==================================================
    // VERIFICA SE RECEBEU CNPJ
    // ==================================================

    if (!cnpjRecebido) {

      return res.status(400).json({

        sucesso: false,

        erro:
          "Envie um CNPJ."
      });
    }


    // ==================================================
    // LIMPA CNPJ
    // ==================================================

    const cnpj =
      limparCNPJ(cnpjRecebido);


    // ==================================================
    // VALIDA TAMANHO
    // ==================================================

    if (cnpj.length !== 14) {

      return res.json({

        sucesso: true,

        cnpj: cnpj,

        resultado:
          "CNPJ INVÁLIDO"
      });
    }


    // ==================================================
    // CONSULTA CNPJá
    // ==================================================

    const resultado =
      await consultarCNPJA(cnpj);


    // ==================================================
    // RETORNA RESULTADO
    // ==================================================

    return res.json({

      sucesso: true,

      cnpj: cnpj,

      resultado:
        resultado.resultado,

      codigo:
        resultado.codigo || null

    });


  } catch (erro) {

    console.error(erro);


    return res.status(500).json({

      sucesso: false,

      erro:
        erro.message
    });
  }

});


// ======================================================
// TESTE DO SERVIDOR
// ======================================================

app.get("/", (req, res) => {

  res.json({

    status: "online",

    sistema:
      "Backend Consulta CNPJ",

    modo:
      "1 CNPJ por consulta",

    intervalo:
      "Controlado pelo Google Sheets",

    apiConfigurada:
      !!CNPJA_API_KEY

  });

});


// ======================================================
// INICIA SERVIDOR
// ======================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Servidor rodando na porta ${PORT}`
    );

  }
);