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
    // DATA DE ABERTURA
    // ==================================================

    const dataAbertura =
      dados.founded || null;


    console.log(
      `CNPJ ${cnpj} - Data abertura: ${dataAbertura}`
    );


    // ==================================================
    // VERIFICA SIMPLES NACIONAL
    // ==================================================

    if (
      dados.company &&
      dados.company.simples
    ) {

      const optante =
        dados.company.simples.optant;


      // ==================================================
      // OPTANTE
      // ==================================================

      if (optante === true) {

        return {
          resultado: "OPTANTE",
          dataAbertura: dataAbertura
        };

      }


      // ==================================================
      // NÃO OPTANTE
      // ==================================================

      if (optante === false) {

        return {
          resultado: "NÃO OPTANTE",
          dataAbertura: dataAbertura
        };

      }

    }


    // ==================================================
    // NÃO IDENTIFICADO
    // ==================================================

    return {
      resultado: "NÃO IDENTIFICADO",
      dataAbertura: dataAbertura
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
// CALCULA SE CNPJ É NOVO
// ======================================================

function cnpjTemAte60Dias(dataAbertura) {

  if (!dataAbertura) {

    return false;

  }


  const data =
    new Date(dataAbertura);


  if (
    isNaN(
      data.getTime()
    )
  ) {

    return false;

  }


  const hoje =
    new Date();


  // Remove horário para comparação correta
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);


  const diferenca =
    hoje.getTime() -
    data.getTime();


  const dias =
    Math.floor(
      diferenca /
      (1000 * 60 * 60 * 24)
    );


  console.log(
    `Data abertura: ${dataAbertura} - Idade: ${dias} dias`
  );


  return (
    dias >= 0 &&
    dias <= 60
  );

}


// ======================================================
// ROTA PARA CONSULTAR 1 CNPJ
// ======================================================

app.post("/consultar", async (req, res) => {

  try {

    const cnpjRecebido =
      req.body.cnpj;


    // ==================================================
    // VERIFICA SE ENVIOU CNPJ
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
    // VERIFICA TAMANHO
    // ==================================================

    if (cnpj.length !== 14) {

      return res.json({

        sucesso: true,

        cnpj: cnpj,

        resultado:
          "CNPJ INVÁLIDO",

        dataAbertura:
          null

      });

    }


    // ==================================================
    // CONSULTA CNPJá
    // ==================================================

    const resultado =
      await consultarCNPJA(cnpj);


    // ==================================================
    // RESULTADO DA CONSULTA
    // ==================================================

    let resultadoFinal =
      resultado.resultado;


    // ==================================================
    // REGRA DOS 60 DIAS
    //
    // Se:
    // NÃO OPTANTE
    // +
    // CNPJ aberto há até 60 dias
    //
    // Resultado:
    // VERIFICAR
    // ==================================================

    if (
      resultado.resultado === "NÃO OPTANTE" &&
      cnpjTemAte60Dias(
        resultado.dataAbertura
      )
    ) {

      resultadoFinal =
        "VERIFICAR";


      console.log(
        `CNPJ ${cnpj} é novo e retornou NÃO OPTANTE.`
      );

      console.log(
        `Resultado alterado para VERIFICAR.`
      );

    }


    // ==================================================
    // RETORNA PARA O GOOGLE SHEETS
    // ==================================================

    return res.json({

      sucesso: true,

      cnpj: cnpj,

      resultado:
        resultadoFinal,

      dataAbertura:
        resultado.dataAbertura || null,

      resultadoAPI:
        resultado.resultado

    });


  } catch (erro) {

    console.error(
      "Erro na rota /consultar:",
      erro
    );


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

    regra:
      "CNPJ novo até 60 dias + NÃO OPTANTE = VERIFICAR",

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