// Importar biblioteca que fará chamadas do tipo HTTP
const axios = require('axios');

// Import biblioteca para ler arquivo
const fs = require('fs');
const FormData = require('form-data');

// Parametros Globais
const endpoint = 'https://joy.classapp.co/graphql';
const access_token = 'SEU_ACESS_TOKEN';
const url = endpoint + '?access_token=' + access_token;
const urlUpload = endpoint + '?access_token=' + access_token + '&target=media';

const autor = 1; // ID da sua entidade na Escola
const idColegioClassApp = 1; // ID da Escola no ClassApp

// Cada escola separa as Tags de Forma diferentes,
// identifique quais tags o Colégio utiliza para enviar o tipo de conteúdo
// Pode ser identificado Vários para o mesmo propósito 1 - n
const boletosTags = ["Responsável Financeiro", "Responsável Pedagógico"];

// Dados a serem enviados
const MENSAGEM = [
  { aluno: "ana", titulo: "Boleto de Dezembro", conteudo: "Ana segue o boleto em anexo", file: "./media/sample.pdf", origName: "Boleto Ana" },
  { aluno: "beto", titulo: "Boleto de Dezembro", conteudo: "Beto segue o boleto em anexo", file: "./media/sample2.pdf", origName: "Boleto Beto"},
  // Caso negativo em que não será encontrado,
  // precisará notificar seu usuário de que X aluno não foi encontrado
  { aluno: "AlunoNaoExisteNoClassApp", titulo: "Boleto de Dezembro", conteudo: "Aluno x segue o boleto em anexo", file: "./media/sample2.pdf", origName: "Boleto X"}
];

// GRAPHQL Query string
construtorBuscaAlunos = (nome) => {
  return `query{
    node(id: ${idColegioClassApp}){
      ... on Organization{
        entities(type: STUDENT, search: "${nome}"){
          nodes{
            dbId
            fullname
            eid
          }
        }
      }
    }
  }`
};

// GRAPHQL Mutation string
construtorEnviaMensagem = (aluno, autor, titulo, conteudo, file, originalName, tags) => {
  let tagsInput = '';
  if(tags){
    tags.forEach(tag => {
      tagsInput += `{name: "${tag}"}, `;
    });
  }

  return `mutation{
    createMessage(input: {
      entityId: ${autor},
      subject: "${titulo}",
      content: "${conteudo}",
      recipients: {
        entityIds: [${aluno}]
      },
      tags: [
        ${tagsInput}
      ]
      medias: [
        {filename: "${file}", type: FILE, origName: "${originalName}"}
      ]
    }) {
      message {
        id
        dbId
        subject
        content
        recipients {
          totalCount
        }
      }
    }
  }`;
};

// GRAPHQL Upload File
construtorCriarMedia = (filename) => {
  return `mutation{
    createMedia(input:{clientMutationId: "${filename}"}){
      media{
        filename
      }
    }
  }`;
}

// Função Envia mensagem para Aluno
enviarMensagem = (mutation) => {
  axios.post(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    query: mutation
  })
    .then(function (response) {
      const { message } = response.data.data.createMessage;

      // URL no ClassApp
      console.log("https://classapp.com.br/entities/"+autor+"/messages/"+message.dbId);
    });
}

// Enviar para toda a lista de alunos que deseja
enviarMensagens = () => {

  //Laço de repetição para cada aluno da lista
  MENSAGEM.forEach(m => {

    // 1. Construir chamada em Graphql
    let idAluno = null;
    const alunos = construtorBuscaAlunos(m.aluno);

    // 2. Colocar chamada Graphql em um request HTTP
    axios.post(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      query: alunos
    })
    .then(function (response) {
      // Pega a lista de resultado
      const { nodes } = response.data.data.node.entities;

      // Encontra ID do aluno caso esteja na lista de alunos
      if (nodes) {
        nodes.map(aluno => {
          if (aluno.fullname === m.aluno) {
            idAluno = aluno.dbId;
          }
        });

        // ERROR
        if(!idAluno) throw Error('Aluno não encontrado');

        // upload do arquivo
        const formData = new FormData();
        formData.append('file', fs.createReadStream(m.file));
        formData.append('query', construtorCriarMedia(m.origName));

        axios.post(urlUpload, formData, {
          method: 'POST',
          headers: formData.getHeaders()
        }).then((response) => {
          const filename = response.data.data.createMedia.media.filename;
          // Criar GRAPHQL para envio de mensagem
          const mensagem = construtorEnviaMensagem(idAluno, autor,
            m.titulo, m.conteudo, filename, m.origName, boletosTags);

            // Enviar Mensagem
            enviarMensagem(mensagem)

          })
          .catch((e) => {
            console.log(e);
          });
        }
      });
  });
}

// Execução da chamada
enviarMensagens();
