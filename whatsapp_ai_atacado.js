const { OpenAI } = require("openai");

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100; // Menor que o retalho
    
    // Limpeza automática a cada 10 minutos
    setInterval(() => {
      this.limparComprovantesAntigos();
    }, 10 * 60 * 1000);
    
    console.log('🧠 IA WhatsApp ATACADO inicializada - Sistema inteligente com cálculo automático de megas');
  }

  // === EXTRAIR NÚMERO DE LEGENDA (FUNÇÃO ESPECÍFICA) ===
  extrairNumeroDeLegenda(legendaImagem) {
    console.log(`   🔍 ATACADO: Analisando legenda da imagem: "${legendaImagem}"`);
    
    if (!legendaImagem || typeof legendaImagem !== 'string' || legendaImagem.trim().length === 0) {
      console.log(`   ❌ ATACADO: Legenda vazia ou inválida`);
      return null;
    }
    
    // Limpar a legenda
    let legendaLimpa = legendaImagem
      .replace(/[📱📲📞☎️🔢💳🎯🤖✅❌⏳💰📊💵📋⚡]/g, ' ') // Remover emojis
      .replace(/\s+/g, ' ') // Normalizar espaços
      .trim();
    
    console.log(`   📝 ATACADO: Legenda limpa: "${legendaLimpa}"`);
    
    // Buscar números de 9 dígitos que começam com 8
    const regexNumeros = /\b8[0-9]{8}\b/g;
    const numerosEncontrados = legendaLimpa.match(regexNumeros) || [];
    
    if (numerosEncontrados.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado na legenda`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números na legenda: ${numerosEncontrados.join(', ')}`);
    
    // Para legendas, ser mais permissivo - geralmente é só o número de destino
    if (numerosEncontrados.length === 1) {
      const numero = numerosEncontrados[0];
      console.log(`   ✅ ATACADO: Número único na legenda aceito: ${numero}`);
      return numero;
    }
    
    // Se múltiplos números, aplicar filtros
    const numerosValidos = [];
    
    for (const numero of numerosEncontrados) {
      const posicao = legendaLimpa.indexOf(numero);
      const contextoBefore = legendaLimpa.substring(Math.max(0, posicao - 30), posicao).toLowerCase();
      const contextoAfter = legendaLimpa.substring(posicao + numero.length, posicao + numero.length + 30).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero} na legenda...`);
      console.log(`   📖 ATACADO: Contexto legenda: "${contextoCompleto}"`);
      
      // Para legendas, indicadores de pagamento são mais raros
      const indicadoresPagamento = [
        'para o', 'para número', 'beneficiário', 'destinatario',
        'taxa foi', 'transferiste'
      ];
      
      const eNumeroPagamento = indicadoresPagamento.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      if (!eNumeroPagamento) {
        numerosValidos.push(numero);
        console.log(`   ✅ ATACADO: Número da legenda aceito: ${numero}`);
      } else {
        console.log(`   ❌ ATACADO: Número da legenda rejeitado: ${numero}`);
      }
    }
    
    if (numerosValidos.length === 1) {
      return numerosValidos[0];
    } else if (numerosValidos.length > 1) {
      console.log(`   ❌ ATACADO: Múltiplos números válidos na legenda: ${numerosValidos.join(', ')}`);
      return { multiplos: true, numeros: numerosValidos };
    }
    
    console.log(`   ❌ ATACADO: Nenhum número válido na legenda`);
    return null;
  }
  extrairPrecosTabela(tabelaTexto) {
    console.log(`   📋 Extraindo preços da tabela atacado...`);
    
    const precos = [];
    const linhas = tabelaTexto.split('\n');
    
    for (const linha of linhas) {
      // Padrões específicos para GB e saldo
      const padroes = [
        // Formato: 10GB➜125MT
        /(\d+)GB➜(\d+)MT/gi,
        // Formato com espaços: 📱 10GB ➜ 125MT
        /📱\s*(\d+)GB\s*➜\s*(\d+)MT/gi,
        // Formato alternativo: 10GB - 125MT
        /(\d+)GB\s*[-–—]\s*(\d+)MT/gi,
        // Formato: 📞 50 💫 45 MT (para saldo)
        /📞\s*(\d+)\s*💫\s*(\d+)\s*MT/gi,
        // Formato alternativo saldo: 50💫 45MT
        /(\d+)💫\s*(\d+)MT/gi
      ];
      
      for (const padrao of padroes) {
        let match;
        while ((match = padrao.exec(linha)) !== null) {
          const quantidade = parseInt(match[1]);
          const preco = parseInt(match[2]);
          
          // Determinar tipo e descrição
          let tipo = 'gb';
          let descricao = '';
          
          if (linha.includes('💫')) {
            tipo = 'saldo';
            descricao = `${quantidade} Saldo`;
          } else if (linha.includes('GB')) {
            tipo = 'gb';
            descricao = `${quantidade}GB`;
          }
          
          precos.push({
            quantidade: quantidade,
            preco: preco,
            descricao: descricao,
            tipo: tipo,
            original: linha.trim()
          });
        }
      }
    }
    
    // Remover duplicatas e ordenar por preço
    const precosUnicos = precos.filter((preco, index, self) => 
      index === self.findIndex(p => p.preco === preco.preco && p.quantidade === preco.quantidade)
    ).sort((a, b) => a.preco - b.preco);
    
    console.log(`   ✅ Preços extraídos: ${precosUnicos.length} pacotes encontrados`);
    
    return precosUnicos;
  }

  // === NOVA FUNÇÃO: CALCULAR MEGAS BASEADO NO VALOR ===
  calcularMegasPorValor(valorPago, configGrupo) {
    console.log(`   🧮 ATACADO: Calculando megas para valor ${valorPago}MT...`);
    
    if (!configGrupo || !configGrupo.tabela) {
      console.log(`   ❌ ATACADO: Tabela do grupo não disponível`);
      return null;
    }
    
    const precos = this.extrairPrecosTabela(configGrupo.tabela);
    
    if (precos.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum preço encontrado na tabela`);
      return null;
    }
    
    const valorNumerico = parseFloat(valorPago);
    
    // Procurar preço exato primeiro
    const precoExato = precos.find(p => p.preco === valorNumerico);
    if (precoExato) {
      console.log(`   ✅ ATACADO: Preço exato encontrado: ${precoExato.descricao}`);
      return {
        megas: precoExato.descricao,
        quantidade: precoExato.quantidade,
        tipo: precoExato.tipo,
        preco: precoExato.preco
      };
    }
    
    // Se não encontrou exato, procurar o mais próximo (dentro de uma tolerância)
    const tolerancia = 5; // MT
    const precoProximo = precos.find(p => 
      Math.abs(p.preco - valorNumerico) <= tolerancia
    );
    
    if (precoProximo) {
      console.log(`   ⚡ ATACADO: Preço aproximado encontrado: ${precoProximo.descricao} (diferença: ${Math.abs(precoProximo.preco - valorNumerico)}MT)`);
      return {
        megas: precoProximo.descricao,
        quantidade: precoProximo.quantidade,
        tipo: precoProximo.tipo,
        preco: precoProximo.preco,
        aproximado: true,
        diferenca: Math.abs(precoProximo.preco - valorNumerico)
      };
    }
    
    // Se não encontrou nada, retornar null
    console.log(`   ❌ ATACADO: Nenhum pacote encontrado para valor ${valorPago}MT`);
    return null;
  }

  // === EXTRAIR NÚMERO ÚNICO (CORRIGIDO) ===
  extrairNumeroUnico(mensagem) {
    console.log(`   🔍 ATACADO: Extraindo número único da mensagem...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida`);
      return null;
    }
    
    // Procurar números de 9 dígitos que começam com 8
    const regex = /\b8[0-9]{8}\b/g;
    const matches = mensagem.match(regex);
    
    if (!matches || matches.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números brutos encontrados: ${matches.join(', ')}`);
    
    // FILTRAR números válidos (removendo números de pagamento)
    const numerosValidos = [];
    
    for (const numero of matches) {
      const posicao = mensagem.indexOf(numero);
      const contextoBefore = mensagem.substring(Math.max(0, posicao - 50), posicao).toLowerCase();
      const contextoAfter = mensagem.substring(posicao + numero.length, posicao + numero.length + 50).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero}...`);
      console.log(`   📖 ATACADO: Contexto antes: "${contextoBefore}"`);
      console.log(`   📖 ATACADO: Contexto depois: "${contextoAfter}"`);
      
      // PALAVRAS QUE INDICAM NÚMERO DE PAGAMENTO (IGNORAR)
      const indicadoresPagamento = [
        'transferiste', 'taxa foi', 'para o número', 'para número', 'para conta',
        'conta de', 'beneficiário', 'destinatario', 'nome:', 'para 8',
        'mt para', 'para ' + numero, numero + ' -', '- ' + numero
      ];
      
      // PALAVRAS QUE INDICAM NÚMERO DE DESTINO (ACEITAR)
      const indicadoresDestino = [
        'megas para', 'manda para', 'enviar para', 'envia para', 
        'ativar para', 'este número', 'este numero', 'receber',
        'activar para', 'ativa para', 'para receber'
      ];
      
      const eNumeroPagamento = indicadoresPagamento.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      const eNumeroDestino = indicadoresDestino.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      // LÓGICA ESPECIAL: Número isolado no final da mensagem
      const tamanhoMensagem = mensagem.length;
      const percentualPosicao = (posicao / tamanhoMensagem) * 100;
      const estaNofinal = percentualPosicao > 70; // Últimos 30% da mensagem
      const contextoAposFinal = contextoAfter.trim();
      const estaIsoladoNoFinal = estaNofinal && (contextoAposFinal === '' || contextoAposFinal.length < 10);
      
      console.log(`   📊 ATACADO: É pagamento: ${eNumeroPagamento}`);
      console.log(`   📊 ATACADO: É destino: ${eNumeroDestino}`);
      console.log(`   📊 ATACADO: Está no final (>70%): ${estaNofinal} (${percentualPosicao.toFixed(1)}%)`);
      console.log(`   📊 ATACADO: Isolado no final: ${estaIsoladoNoFinal}`);
      
      // LÓGICA DE DECISÃO CORRIGIDA
      if (eNumeroDestino) {
        numerosValidos.push(numero);
        console.log(`   ✅ ATACADO: ACEITO por contexto de destino: ${numero}`);
      } else if (eNumeroPagamento) {
        console.log(`   ❌ ATACADO: REJEITADO por ser pagamento: ${numero}`);
      } else if (estaIsoladoNoFinal) {
        numerosValidos.push(numero);
        console.log(`   ✅ ATACADO: ACEITO por estar isolado no final: ${numero}`);
      } else if (estaNofinal && !eNumeroPagamento) {
        numerosValidos.push(numero);
        console.log(`   ✅ ATACADO: ACEITO por estar no final: ${numero}`);
      } else {
        console.log(`   ❌ ATACADO: REJEITADO por ser ambíguo: ${numero}`);
      }
    }
    
    // Remover duplicatas
    const numerosUnicos = [...new Set(numerosValidos)];
    console.log(`   📱 ATACADO: Números válidos após filtragem: ${numerosUnicos.join(', ')}`);
    
    // AGORA verificar se há múltiplos números VÁLIDOS
    if (numerosUnicos.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número válido encontrado`);
      return null;
    }
    
    if (numerosUnicos.length > 1) {
      console.log(`   ❌ ATACADO: Múltiplos números VÁLIDOS detectados: ${numerosUnicos.join(', ')}`);
      console.log(`   ⚠️ ATACADO: Sistema aceita apenas UM número por vez`);
      return { multiplos: true, numeros: numerosUnicos };
    }
    
    const numeroFinal = numerosUnicos[0];
    console.log(`   ✅ ATACADO: Número único válido aceito: ${numeroFinal}`);
    return numeroFinal;
  }

  // === SEPARAR COMPROVANTE E NÚMERO (CORRIGIDO) ===
  separarComprovanteENumero(mensagem) {
    console.log(`   🔍 ATACADO: Separando comprovante e número...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida para separação`);
      return { textoComprovante: '', numero: null };
    }
    
    const resultadoNumero = this.extrairNumeroUnico(mensagem);
    
    // Se encontrou múltiplos números VÁLIDOS, retornar erro
    if (resultadoNumero && resultadoNumero.multiplos) {
      return { 
        textoComprovante: '', 
        numero: null, 
        erro: 'multiplos_numeros',
        numeros: resultadoNumero.numeros 
      };
    }
    
    const numero = resultadoNumero;
    
    // Criar texto do comprovante removendo número
    let textoComprovante = mensagem;
    
    if (numero) {
      // Remover o número e possível contexto ao redor
      const padroes = [
        new RegExp(`\\s*megas? para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*manda para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*envia para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*enviar para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*este\\s+número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*numero\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*${numero}\\s*$`, 'gi'), // Número no final
        new RegExp(`^\\s*${numero}\\s*`, 'gi') // Número no início
      ];
      
      for (const padrao of padroes) {
        textoComprovante = textoComprovante.replace(padrao, ' ');
      }
    }
    
    // Limpar espaços extras
    textoComprovante = textoComprovante.replace(/\s+/g, ' ').trim();
    
    console.log(`   📄 ATACADO: Texto do comprovante: ${textoComprovante.substring(0, 50)}...`);
    console.log(`   📱 ATACADO: Número extraído: ${numero || 'nenhum'}`);
    
    return {
      textoComprovante: textoComprovante,
      numero: numero
    };
  }

  // === BUSCAR COMPROVANTE RECENTE NO HISTÓRICO ===
  async buscarComprovanteRecenteNoHistorico(remetente, timestamp) {
    console.log(`   🔍 ATACADO: Buscando comprovante recente no histórico...`);

    // 30 minutos
    const mensagensRecentes = this.historicoMensagens.filter(msg => {
      const timeDiff = timestamp - msg.timestamp;
      return msg.remetente === remetente && timeDiff <= 1800000; // 30 minutos
    });

    if (mensagensRecentes.length === 0) {
      console.log(`   ❌ ATACADO: Nenhuma mensagem recente de ${remetente} nos últimos 30 minutos`);
      return null;
    }

    console.log(`   📊 ATACADO: Analisando ${mensagensRecentes.length} mensagens dos últimos 30 minutos...`);

    // Procurar comprovante nas mensagens recentes (mais recentes primeiro)
    for (let msg of mensagensRecentes.reverse()) {
      if (msg.tipo === 'texto') {
        console.log(`   🔍 ATACADO: Verificando mensagem: "${msg.mensagem.substring(0, 50)}..."`);
        
        const comprovante = await this.analisarComprovante(msg.mensagem);
        if (comprovante) {
          const tempoDecorrido = Math.floor((timestamp - msg.timestamp) / 60000);
          console.log(`   ✅ ATACADO: Comprovante encontrado no histórico: ${comprovante.referencia} - ${comprovante.valor}MT (${tempoDecorrido} min atrás)`);
          return comprovante;
        }
      }
    }

    console.log(`   ❌ ATACADO: Comprovante não encontrado no histórico`);
    return null;
  }

  // === FUNÇÃO PRINCIPAL PARA O BOT (SIMPLIFICADA) ===
  async processarMensagemBot(mensagem, remetente, tipoMensagem = 'texto', configGrupo = null, legendaImagem = null) {
    const timestamp = Date.now();
    
    // Log para debug
    if (tipoMensagem === 'imagem') {
      console.log(`\n🧠 IA ATACADO processando IMAGEM de ${remetente}`);
      if (legendaImagem && legendaImagem.trim().length > 0) {
        console.log(`📝 Com legenda: "${legendaImagem.substring(0, 100)}..."`);
      } else {
        console.log(`📝 Sem legenda ou legenda vazia`);
      }
    } else {
      console.log(`\n🧠 IA ATACADO processando TEXTO de ${remetente}: ${mensagem.substring(0, 50)}...`);
    }
    
    // Adicionar ao histórico
    this.adicionarAoHistorico(mensagem, remetente, timestamp, tipoMensagem);
    
    try {
      if (tipoMensagem === 'imagem') {
        return await this.processarImagem(mensagem, remetente, timestamp, configGrupo, legendaImagem);
      } else {
        return await this.processarTexto(mensagem, remetente, timestamp, configGrupo);
      }
    } catch (error) {
      console.error('❌ ATACADO: Erro na IA:', error);
      return { erro: true, mensagem: error.message };
    }
  }

  // === PROCESSAR TEXTO (SIMPLIFICADO) ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo = null) {
    console.log(`   📝 ATACADO: Analisando mensagem: "${mensagem}"`);
    
    // VERIFICAR se é apenas um número
    const mensagemLimpa = mensagem.trim();
    const apenasNumeroRegex = /^8[0-9]{8}$/;
    
    if (apenasNumeroRegex.test(mensagemLimpa)) {
      console.log(`   📱 ATACADO: Detectado número isolado: ${mensagemLimpa}`);
      return await this.processarNumero(mensagemLimpa, remetente, timestamp, configGrupo);
    }
    
    // SEPARAR comprovante e número
    const resultado = this.separarComprovanteENumero(mensagem);
    
    // Se encontrou múltiplos números, retornar erro
    if (resultado.erro === 'multiplos_numeros') {
      console.log(`   ❌ ATACADO: Múltiplos números não permitidos`);
      return {
        sucesso: false,
        tipo: 'multiplos_numeros_nao_permitido',
        numeros: resultado.numeros,
        mensagem: 'Sistema atacado aceita apenas UM número por vez.'
      };
    }
    
    const { textoComprovante, numero } = resultado;
    
    // 1. Verificar se é um comprovante
    let comprovante = null;
    if (textoComprovante && textoComprovante.length > 10) {
      comprovante = await this.analisarComprovante(textoComprovante);
    }
    
    // 2. Se encontrou comprovante E número na mesma mensagem
    if (comprovante && numero) {
      console.log(`   🎯 ATACADO: COMPROVANTE + NÚMERO na mesma mensagem!`);
      console.log(`   💰 ATACADO: Comprovante: ${comprovante.referencia} - ${comprovante.valor}MT`);
      console.log(`   📱 ATACADO: Número: ${numero}`);
      
      // CALCULAR MEGAS AUTOMATICAMENTE
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numero}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
        };
      }
    }
    
    // 3. Se encontrou apenas número (sem comprovante)
    if (numero && !comprovante) {
      console.log(`   📱 ATACADO: Apenas número detectado: ${numero}`);
      return await this.processarNumero(numero, remetente, timestamp, configGrupo);
    }
    
    // 4. Se encontrou apenas comprovante (sem número)
    if (comprovante && !numero) {
      console.log(`   💰 ATACADO: Apenas comprovante detectado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      // VERIFICAR se o valor existe na tabela
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        await this.processarComprovante(comprovante, remetente, timestamp);
        
        return { 
          sucesso: true, 
          tipo: 'comprovante_recebido',
          referencia: comprovante.referencia,
          valor: comprovante.valor,
          megas: megasCalculados.megas,
          mensagem: `Comprovante recebido! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}. Agora envie UM número que vai receber os megas.`
        };
      } else {
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
        };
      }
    }
    
    // 5. Não reconheceu
    console.log(`   ❓ ATACADO: Mensagem não reconhecida como comprovante ou número`);
    return { 
      sucesso: false, 
      tipo: 'mensagem_nao_reconhecida',
      mensagem: null 
    };
  }

  // === PROCESSAR IMAGEM (SIMPLIFICADO) ===
  async processarImagem(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   📸 ATACADO: Processando imagem de ${remetente}`);
    
    // Validação melhorada da legenda
    const temLegendaValida = legendaImagem && 
                            typeof legendaImagem === 'string' && 
                            legendaImagem.trim().length > 0 &&
                            legendaImagem.trim() !== '';
    
    if (temLegendaValida) {
      console.log(`   📝 ATACADO: Legenda detectada (${legendaImagem.trim().length} chars): "${legendaImagem.trim()}"`);
    } else {
      console.log(`   📝 ATACADO: Sem legenda válida`);
    }
    
    const prompt = `
Analisa esta imagem de comprovante de pagamento M-Pesa ou E-Mola de Moçambique.

Procura por:
1. Referência da transação (exemplos: CGC4GQ17W84, PP250712.2035.u31398, etc.)
2. Valor transferido (em MT - Meticais)

ATENÇÃO: 
- Procura por palavras como "Confirmado", "ID da transacao", "Transferiste"
- O valor pode estar em formato "100.00MT", "100MT", "100,00MT"
- A referência é geralmente um código alfanumérico

Responde APENAS no formato JSON:
{
  "referencia": "CGC4GQ17W84",
  "valor": "210",
  "encontrado": true
}

Se não conseguires ler a imagem ou extrair os dados:
{"encontrado": false}
`;

    try {
      const resposta = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imagemBase64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      console.log(`   🔍 ATACADO: Resposta da IA para imagem: ${resposta.choices[0].message.content}`);
      
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      console.log(`   ✅ ATACADO: JSON extraído da imagem:`, resultado);
      
      if (resultado.encontrado) {
        const comprovante = {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'imagem'
        };
        
        console.log(`   ✅ ATACADO: Dados extraídos da imagem: ${comprovante.referencia} - ${comprovante.valor}MT`);
        
        // VERIFICAR SE HÁ LEGENDA COM NÚMERO
        if (temLegendaValida) {
          console.log(`   🔍 ATACADO: ANALISANDO LEGENDA DA IMAGEM...`);
          
          // Usar função específica para legenda
          const numeroLegenda = this.extrairNumeroDeLegenda(legendaImagem);
          
          // Se encontrou múltiplos números na legenda, retornar erro
          if (numeroLegenda && numeroLegenda.multiplos) {
            console.log(`   ❌ ATACADO: Múltiplos números na legenda não permitidos`);
            return {
              sucesso: false,
              tipo: 'multiplos_numeros_nao_permitido',
              numeros: numeroLegenda.numeros,
              mensagem: 'Sistema atacado aceita apenas UM número por vez.'
            };
          }
          
          if (numeroLegenda) {
            console.log(`   🎯 ATACADO: IMAGEM + NÚMERO NA LEGENDA DETECTADOS!`);
            console.log(`   💰 ATACADO: Comprovante da imagem: ${comprovante.referencia} - ${comprovante.valor}MT`);
            console.log(`   📱 ATACADO: Número da legenda: ${numeroLegenda}`);
            
            // CALCULAR MEGAS AUTOMATICAMENTE
            const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
            
            if (megasCalculados) {
              const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numeroLegenda}`;
              console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO (IMAGEM + LEGENDA): ${resultado}`);
              return { 
                sucesso: true, 
                dadosCompletos: resultado,
                tipo: 'numero_processado',
                numero: numeroLegenda,
                megas: megasCalculados.megas,
                valorPago: comprovante.valor,
                fonte: 'imagem_com_legenda'
              };
            } else {
              console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
              return {
                sucesso: false,
                tipo: 'valor_nao_encontrado_na_tabela',
                valor: comprovante.valor,
                mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
              };
            }
          } else {
            console.log(`   ❌ ATACADO: Nenhum número válido encontrado na legenda`);
          }
        } else {
          console.log(`   ⚠️ ATACADO: Legenda não disponível ou vazia`);
        }
        
        // Sem número na legenda - processar comprovante normalmente
        // VERIFICAR se o valor existe na tabela
        const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
        
        if (megasCalculados) {
          await this.processarComprovante(comprovante, remetente, timestamp);
          
          return { 
            sucesso: true, 
            tipo: 'comprovante_imagem_recebido',
            referencia: comprovante.referencia,
            valor: comprovante.valor,
            megas: megasCalculados.megas,
            mensagem: `Comprovante da imagem processado! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}. Agora envie UM número que vai receber os megas.`
          };
        } else {
          return {
            sucesso: false,
            tipo: 'valor_nao_encontrado_na_tabela',
            valor: comprovante.valor,
            mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
          };
        }
      } else {
        console.log(`   ❌ ATACADO: IA não conseguiu extrair dados da imagem`);
        return {
          sucesso: false,
          tipo: 'imagem_nao_reconhecida',
          mensagem: 'Não consegui ler o comprovante na imagem. Envie como texto.'
        };
      }
      
    } catch (error) {
      console.error('❌ ATACADO: Erro ao processar imagem:', error);
      return {
        sucesso: false,
        tipo: 'erro_processamento_imagem',
        mensagem: 'Erro ao processar imagem. Tente enviar como texto.'
      };
    }
  }

  // === PROCESSAR NÚMERO (SIMPLIFICADO) ===
  async processarNumero(numero, remetente, timestamp, configGrupo = null) {
    console.log(`   🔢 ATACADO: Processando número ${numero} para ${remetente}`);
    
    // Verificar se tem comprovante em aberto
    if (this.comprovantesEmAberto[remetente]) {
      const comprovante = this.comprovantesEmAberto[remetente];
      console.log(`   ✅ ATACADO: Comprovante em aberto encontrado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      // CALCULAR MEGAS AUTOMATICAMENTE
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numero}`;
        delete this.comprovantesEmAberto[remetente];
        
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor,
          origem: 'comprovante_em_aberto'
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
        };
      }
    }

    // SE NÃO TEM COMPROVANTE EM ABERTO, buscar no histórico
    console.log(`   ❌ ATACADO: Nenhum comprovante em aberto. Buscando no histórico...`);
    const comprovante = await this.buscarComprovanteRecenteNoHistorico(remetente, timestamp);
    
    if (comprovante) {
      // CALCULAR MEGAS AUTOMATICAMENTE
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numero}`;
        console.log(`   ✅ ATACADO: ENCONTRADO NO HISTÓRICO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor,
          origem: 'historico'
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `Valor ${comprovante.valor}MT não encontrado na tabela de preços. Verifique os valores disponíveis.`
        };
      }
    }

    // Sem comprovante
    console.log(`   ❌ ATACADO: Nenhum comprovante encontrado`);
    return { 
      sucesso: false, 
      tipo: 'numero_sem_comprovante',
      numero: numero,
      mensagem: `Número detectado, mas não encontrei comprovante nos últimos 30 minutos. Envie o comprovante primeiro.`
    };
  }

  // === FUNÇÃO AUXILIAR PARA EXTRAIR JSON ===
  extrairJSON(texto) {
    try {
      return JSON.parse(texto);
    } catch (e) {
      try {
        let limpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(limpo);
      } catch (e2) {
        try {
          const match = texto.match(/\{[\s\S]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (e3) {
          throw new Error(`Não foi possível extrair JSON: ${texto}`);
        }
      }
    }
  }

  // === ANALISAR COMPROVANTE ===
  async analisarComprovante(mensagem) {
    const temConfirmado = /^confirmado/i.test(mensagem.trim());
    const temID = /^id\s/i.test(mensagem.trim());
    
    if (!temConfirmado && !temID) {
      return null;
    }

    const prompt = `
Analisa esta mensagem de comprovante de pagamento M-Pesa ou E-Mola:

"${mensagem}"

Extrai a referência da transação e o valor transferido.

Responde APENAS no formato JSON:
{
  "referencia": "CGC4GQ17W84",
  "valor": "210",
  "encontrado": true
}

Se não conseguires extrair, responde:
{"encontrado": false}
`;

    const resposta = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é especialista em analisar comprovantes de pagamento moçambicanos M-Pesa e E-Mola." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    try {
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      
      if (resultado.encontrado) {
        return {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'texto'
        };
      }
    } catch (parseError) {
      console.error('❌ ATACADO: Erro ao parsear resposta da IA:', parseError);
    }

    return null;
  }

  // === PROCESSAR COMPROVANTE ===
  async processarComprovante(comprovante, remetente, timestamp) {
    this.comprovantesEmAberto[remetente] = {
      referencia: comprovante.referencia,
      valor: comprovante.valor,
      timestamp: timestamp,
      fonte: comprovante.fonte
    };

    console.log(`   ⏳ ATACADO: Comprovante de ${remetente} guardado, aguardando número...`);
  }

  // === LIMPAR VALOR MONETÁRIO ===
  limparValor(valor) {
    if (!valor) return '0';
    
    let valorStr = valor.toString();
    valorStr = valorStr.replace(/\s*(MT|mt|meticais?|metical)\s*/gi, '');
    valorStr = valorStr.trim();
    
    if (valorStr.includes(',') && valorStr.includes('.')) {
      valorStr = valorStr.replace(/,/g, '');
    } else if (valorStr.includes(',')) {
      const parts = valorStr.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        valorStr = valorStr.replace(',', '.');
      } else {
        valorStr = valorStr.replace(/,/g, '');
      }
    }
    
    const match = valorStr.match(/\d+\.?\d*/);
    if (match) {
      const numero = parseFloat(match[0]);
      return numero.toString();
    }
    
    const digitos = valorStr.replace(/[^\d]/g, '');
    return digitos || '0';
  }

  // === HISTÓRICO ===
  adicionarAoHistorico(mensagem, remetente, timestamp, tipo = 'texto') {
    this.historicoMensagens.push({
      mensagem,
      remetente,
      timestamp,
      tipo
    });

    if (this.historicoMensagens.length > this.maxHistorico) {
      this.historicoMensagens = this.historicoMensagens.slice(-this.maxHistorico);
    }
  }

  // === LIMPEZA ===
  limparComprovantesAntigos() {
    const agora = Date.now();
    const timeout = 45 * 60 * 1000; // 45 minutos
    let removidos = 0;

    Object.keys(this.comprovantesEmAberto).forEach(remetente => {
      const comprovante = this.comprovantesEmAberto[remetente];
      if (agora - comprovante.timestamp > timeout) {
        delete this.comprovantesEmAberto[remetente];
        removidos++;
      }
    });

    if (removidos > 0) {
      console.log(`🗑️ ATACADO: Removidos ${removidos} comprovantes antigos (>45min)`);
    }
  }

  // === STATUS ===
  getStatus() {
    return {
      comprovantesEmAberto: Object.keys(this.comprovantesEmAberto).length,
      mensagensNoHistorico: this.historicoMensagens.length,
      detalhesComprovantes: this.comprovantesEmAberto
    };
  }

  // === FUNÇÃO PARA COMANDOS ADMIN ===
  getStatusDetalhado() {
    let status = `🧠 *STATUS DA IA ATACADO v1.1*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    status += `💾 Mensagens no histórico: ${this.historicoMensagens.length}\n`;
    status += `⏳ Comprovantes em aberto: ${Object.keys(this.comprovantesEmAberto).length}\n\n`;
    
    if (Object.keys(this.comprovantesEmAberto).length > 0) {
      status += `📋 *Comprovantes aguardando número:*\n`;
      Object.entries(this.comprovantesEmAberto).forEach(([remetente, comp]) => {
        const tempo = Math.floor((Date.now() - comp.timestamp) / 60000);
        status += `• ${remetente.replace('@c.us', '')}: ${comp.referencia} - ${comp.valor}MT (${tempo}min)\n`;
      });
    }
    
    status += `\n�� *SISTEMA ATACADO v2.0:*\n`;
    status += `✅ Cálculo automático de megas!\n`;
    status += `✅ Formato REF|MEGAS|NUMERO!\n`;
    status += `✅ Valor integral por número!\n`;
    status += `✅ UM número por vez!\n`;
    status += `✅ CORRIGIDO: Filtra números de pagamento!\n`;
    status += `✅ CORRIGIDO: Ignora números em contexto de transferência!\n`;
    status += `✅ Sistema inteligente e automatizado!\n`;
    status += `✅ Processamento direto com IA!\n`;
    
    return status;
  }
}

module.exports = WhatsAppAIAtacado;
