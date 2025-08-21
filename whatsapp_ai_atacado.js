const { OpenAI } = require("openai");

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100;
    
    setInterval(() => {
      this.limparComprovantesAntigos();
    }, 10 * 60 * 1000);
    
    console.log('🧠 IA WhatsApp ATACADO inicializada - Sistema inteligente com cálculo automático de megas E processamento de imagens melhorado');
  }

  // === CÓDIGO ORIGINAL MANTIDO - PROCESSAMENTO DE TEXTO ===
  
  // === FUNÇÃO AUXILIAR PARA LIMPEZA DE NÚMEROS ===
  limparNumero(numero) {
    if (!numero || typeof numero !== 'string') {
      return numero;
    }
    
    let numeroLimpo = numero
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/^\+258\s*/, '')
      .replace(/\s+/g, '')
      .trim();
    
    if (/^8[0-9]{8}$/.test(numeroLimpo)) {
      return numeroLimpo;
    }
    
    return numero;
  }

  // === EXTRAIR NÚMERO DE LEGENDA (CÓDIGO ORIGINAL) ===
  extrairNumeroDeLegenda(legendaImagem) {
    console.log(`   🔍 ATACADO: Analisando legenda da imagem: "${legendaImagem}"`);
    
    if (!legendaImagem || typeof legendaImagem !== 'string' || legendaImagem.trim().length === 0) {
      console.log(`   ❌ ATACADO: Legenda vazia ou inválida`);
      return null;
    }
    
    let legendaLimpa = legendaImagem
      .replace(/[📱📲📞☎️🔢💳🎯🤖✅❌⏳💰📊💵📋⚡]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`   📝 ATACADO: Legenda limpa: "${legendaLimpa}"`);
    
    const regexNumeros = /(?:\+258\s*)?8[0-9]{8}/g;
    const numerosEncontrados = legendaLimpa.match(regexNumeros) || [];
    
    if (numerosEncontrados.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado na legenda`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números na legenda: ${numerosEncontrados.join(', ')}`);
    
    if (numerosEncontrados.length === 1) {
      const numero = this.limparNumero(numerosEncontrados[0]);
      console.log(`   ✅ ATACADO: Número único na legenda aceito: ${numero}`);
      return numero;
    }
    
    const numerosValidos = [];
    
    for (const numero of numerosEncontrados) {
      const posicao = legendaLimpa.indexOf(numero);
      const contextoBefore = legendaLimpa.substring(Math.max(0, posicao - 30), posicao).toLowerCase();
      const contextoAfter = legendaLimpa.substring(posicao + numero.length, posicao + numero.length + 30).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero} na legenda...`);
      console.log(`   📖 ATACADO: Contexto legenda: "${contextoCompleto}"`);
      
      const indicadoresPagamento = [
        'para o', 'para número', 'beneficiário', 'destinatario',
        'taxa foi', 'transferiste'
      ];
      
      const eNumeroPagamento = indicadoresPagamento.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      if (!eNumeroPagamento) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: Número da legenda aceito: ${numeroLimpo} (original: ${numero})`);
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

  // === EXTRAIR PREÇOS TABELA (CÓDIGO ORIGINAL) ===
  extrairPrecosTabela(tabelaTexto) {
    console.log(`   📋 Extraindo preços da tabela atacado...`);
    
    const precos = [];
    const linhas = tabelaTexto.split('\n');
    
    for (const linha of linhas) {
      const padroes = [
        /(\d+)GB➜(\d+)MT/gi,
        /📱\s*(\d+)GB\s*➜\s*(\d+)MT/gi,
        /(\d+)GB\s*[-–—]\s*(\d+)MT/gi,
        /📞\s*(\d+)\s*💫\s*(\d+)\s*MT/gi,
        /(\d+)💫\s*(\d+)MT/gi
      ];
      
      for (const padrao of padroes) {
        let match;
        while ((match = padrao.exec(linha)) !== null) {
          const quantidade = parseInt(match[1]);
          const preco = parseInt(match[2]);
          
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
    
    const precosUnicos = precos.filter((preco, index, self) => 
      index === self.findIndex(p => p.preco === preco.preco && p.quantidade === preco.quantidade)
    ).sort((a, b) => a.preco - b.preco);
    
    console.log(`   ✅ Preços extraídos: ${precosUnicos.length} pacotes encontrados`);
    
    return precosUnicos;
  }

  // === CALCULAR MEGAS POR VALOR (CÓDIGO ORIGINAL) ===
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
    
    const tolerancia = 5;
    const precoProximo = precos.find(p => 
      Math.abs(p.preco - valorNumerico) <= tolerancia
    );
    
    if (precoProximo) {
      console.log(`   ⚡ ATACADO: Preço aproximado encontrado: ${precoProximo.descricao}`);
      return {
        megas: precoProximo.descricao,
        quantidade: precoProximo.quantidade,
        tipo: precoProximo.tipo,
        preco: precoProximo.preco,
        aproximado: true,
        diferenca: Math.abs(precoProximo.preco - valorNumerico)
      };
    }
    
    console.log(`   ❌ ATACADO: Nenhum pacote encontrado para valor ${valorPago}MT`);
    return null;
  }

  // === EXTRAIR NÚMERO ÚNICO (CÓDIGO ORIGINAL) ===
  extrairNumeroUnico(mensagem) {
    console.log(`   🔍 ATACADO: Extraindo número único da mensagem...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida`);
      return null;
    }
    
    const regex = /(?:\+258\s*)?8[0-9]{8}/g;
    const matches = mensagem.match(regex);
    
    if (!matches || matches.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números brutos encontrados: ${matches.join(', ')}`);
    
    const numerosValidos = [];
    
    for (const numero of matches) {
      const posicao = mensagem.indexOf(numero);
      const contextoBefore = mensagem.substring(Math.max(0, posicao - 50), posicao).toLowerCase();
      const contextoAfter = mensagem.substring(posicao + numero.length, posicao + numero.length + 50).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero}...`);
      console.log(`   📖 ATACADO: Contexto antes: "${contextoBefore}"`);
      console.log(`   📖 ATACADO: Contexto depois: "${contextoAfter}"`);
      
      const indicadoresPagamento = [
        'transferiste', 'taxa foi', 'para o número', 'para número', 'para conta',
        'conta de', 'beneficiário', 'destinatario', 'nome:', 'para 8',
        'mt para', 'para ' + numero, numero + ' -', '- ' + numero
      ];
      
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
      
      const tamanhoMensagem = mensagem.length;
      const percentualPosicao = (posicao / tamanhoMensagem) * 100;
      const estaNofinal = percentualPosicao > 70;
      const contextoAposFinal = contextoAfter.trim();
      const estaIsoladoNoFinal = estaNofinal && (contextoAposFinal === '' || contextoAposFinal.length < 10);
      
      console.log(`   📊 ATACADO: É pagamento: ${eNumeroPagamento}`);
      console.log(`   📊 ATACADO: É destino: ${eNumeroDestino}`);
      console.log(`   📊 ATACADO: Está no final (>70%): ${estaNofinal} (${percentualPosicao.toFixed(1)}%)`);
      console.log(`   📊 ATACADO: Isolado no final: ${estaIsoladoNoFinal}`);
      
      if (eNumeroDestino) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por contexto de destino: ${numeroLimpo} (original: ${numero})`);
      } else if (eNumeroPagamento) {
        console.log(`   ❌ ATACADO: REJEITADO por ser pagamento: ${numero}`);
      } else if (estaIsoladoNoFinal) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por estar isolado no final: ${numeroLimpo} (original: ${numero})`);
      } else if (estaNofinal && !eNumeroPagamento) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por estar no final: ${numeroLimpo} (original: ${numero})`);
      } else {
        console.log(`   ❌ ATACADO: REJEITADO por ser ambíguo: ${numero}`);
      }
    }
    
    const numerosUnicos = [...new Set(numerosValidos)];
    console.log(`   📱 ATACADO: Números válidos após filtragem: ${numerosUnicos.join(', ')}`);
    
    if (numerosUnicos.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número válido encontrado`);
      return null;
    }
    
    if (numerosUnicos.length > 1) {
      console.log(`   ❌ ATACADO: Múltiplos números VÁLIDOS detectados: ${numerosUnicos.join(', ')}`);
      console.log(`   ⚠️ ATACADO: Sistema aceita apenas UM número por vez`);
      return { multiplos: true, numeros: numerosUnicos };
    }
    
    const numeroFinal = this.limparNumero(numerosUnicos[0]);
    console.log(`   ✅ ATACADO: Número único válido aceito: ${numeroFinal}`);
    return numeroFinal;
  }

  // === SEPARAR COMPROVANTE E NÚMERO (CÓDIGO ORIGINAL) ===
  separarComprovanteENumero(mensagem) {
    console.log(`   🔍 ATACADO: Separando comprovante e número...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida para separação`);
      return { textoComprovante: '', numero: null };
    }
    
    const resultadoNumero = this.extrairNumeroUnico(mensagem);
    
    if (resultadoNumero && resultadoNumero.multiplos) {
      return { 
        textoComprovante: '', 
        numero: null, 
        erro: 'multiplos_numeros',
        numeros: resultadoNumero.numeros 
      };
    }
    
    const numero = resultadoNumero;
    
    let textoComprovante = mensagem;
    
    if (numero) {
      const padroes = [
        new RegExp(`\\s*megas? para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*manda para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*envia para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*enviar para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*este\\s+número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*numero\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*${numero}\\s*$`, 'gi'),
        new RegExp(`^\\s*${numero}\\s*`, 'gi')
      ];
      
      for (const padrao of padroes) {
        textoComprovante = textoComprovante.replace(padrao, ' ');
      }
    }
    
    textoComprovante = textoComprovante.replace(/\s+/g, ' ').trim();
    
    console.log(`   📄 ATACADO: Texto do comprovante: ${textoComprovante.substring(0, 50)}...`);
    console.log(`   📱 ATACADO: Número extraído: ${numero || 'nenhum'}`);
    
    return {
      textoComprovante: textoComprovante,
      numero: numero
    };
  }

  // === BUSCAR COMPROVANTE RECENTE NO HISTÓRICO (CÓDIGO ORIGINAL) ===
  async buscarComprovanteRecenteNoHistorico(remetente, timestamp) {
    console.log(`   🔍 ATACADO: Buscando comprovante recente no histórico...`);

    const mensagensRecentes = this.historicoMensagens.filter(msg => {
      const timeDiff = timestamp - msg.timestamp;
      return msg.remetente === remetente && timeDiff <= 1800000;
    });

    if (mensagensRecentes.length === 0) {
      console.log(`   ❌ ATACADO: Nenhuma mensagem recente de ${remetente} nos últimos 30 minutos`);
      return null;
    }

    console.log(`   📊 ATACADO: Analisando ${mensagensRecentes.length} mensagens dos últimos 30 minutos...`);

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

  // === MÉTODO ADICIONADO: ADICIONAR AO HISTÓRICO ===
  adicionarAoHistorico(mensagem, remetente, timestamp, tipo) {
    this.historicoMensagens.push({
      mensagem: mensagem,
      remetente: remetente,
      timestamp: timestamp,
      tipo: tipo
    });

    // Manter apenas as últimas mensagens conforme maxHistorico
    if (this.historicoMensagens.length > this.maxHistorico) {
      this.historicoMensagens = this.historicoMensagens.slice(-this.maxHistorico);
    }
  }

  // === MÉTODO ADICIONADO: LIMPAR COMPROVANTES ANTIGOS ===
  limparComprovantesAntigos() {
    const agora = Date.now();
    const tempoLimite = 30 * 60 * 1000; // 30 minutos

    for (const [chave, comprovante] of Object.entries(this.comprovantesEmAberto)) {
      if (agora - comprovante.timestamp > tempoLimite) {
        delete this.comprovantesEmAberto[chave];
        console.log(`   🗑️ ATACADO: Comprovante expirado removido: ${chave}`);
      }
    }
  }

  // === MÉTODO ADICIONADO: PROCESSAR COMPROVANTE ===
  async processarComprovante(comprovante, remetente, timestamp) {
    const chave = `${remetente}_${timestamp}`;
    this.comprovantesEmAberto[chave] = {
      ...comprovante,
      timestamp: timestamp,
      remetente: remetente
    };
    console.log(`   💾 ATACADO: Comprovante armazenado: ${chave}`);
  }

  // === MÉTODO ADICIONADO: PROCESSAR NÚMERO ===
  async processarNumero(numero, remetente, timestamp, configGrupo) {
    console.log(`   📱 ATACADO: Processando número ${numero} para ${remetente}`);

    // Buscar comprovante em aberto do usuário
    const comprovanteEmAberto = Object.values(this.comprovantesEmAberto).find(
      comp => comp.remetente === remetente
    );

    if (comprovanteEmAberto) {
      console.log(`   ✅ ATACADO: Comprovante em aberto encontrado!`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovanteEmAberto.valor, configGrupo);
      
      if (megasCalculados) {
        // Remover o comprovante usado
        const chaveParaRemover = Object.keys(this.comprovantesEmAberto).find(
          chave => this.comprovantesEmAberto[chave].remetente === remetente
        );
        if (chaveParaRemover) {
          delete this.comprovantesEmAberto[chaveParaRemover];
        }

        const resultado = `${comprovanteEmAberto.referencia}|${megasCalculados.megas}|${numero}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO: ${resultado}`);
        
        return {
          sucesso: true,
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovanteEmAberto.valor
        };
      } else {
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovanteEmAberto.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovanteEmAberto.referencia}\n💰 *VALOR:* ${comprovanteEmAberto.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }

    // Buscar no histórico
    const comprovanteHistorico = await this.buscarComprovanteRecenteNoHistorico(remetente, timestamp);
    
    if (comprovanteHistorico) {
      const megasCalculados = this.calcularMegasPorValor(comprovanteHistorico.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovanteHistorico.referencia}|${megasCalculados.megas}|${numero}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO COM HISTÓRICO: ${resultado}`);
        
        return {
          sucesso: true,
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovanteHistorico.valor
        };
      }
    }

    console.log(`   ❌ ATACADO: Nenhum comprovante encontrado para o número ${numero}`);
    return {
      sucesso: false,
      tipo: 'numero_sem_comprovante',
      numero: numero,
      mensagem: `📱 *NÚMERO RECEBIDO:* ${numero}\n\n❌ *Comprovante não encontrado!*\n\n💡 Envie primeiro o comprovante, depois o número\n⏰ Ou envie tudo junto na mesma mensagem`
    };
  }

  // === MÉTODO ADICIONADO: ANALISAR COMPROVANTE ===
  async analisarComprovante(textoComprovante) {
    try {
      console.log(`   🤖 ATACADO: Analisando comprovante com IA...`);
      
      const prompt = `
Analise este texto de comprovante M-Pesa/E-Mola de Moçambique e extraia:

1. REFERÊNCIA (ID da transação)
2. VALOR (em MT)

FORMATO E-MOLA: PP######.####.##### (PP + 6 dígitos + . + 4 dígitos + . + 5+ caracteres)
FORMATO M-PESA: Código alfanumérico (exemplo: CHK8H3PYKpe)

Texto: "${textoComprovante}"

Responda APENAS no formato JSON:
{
  "referencia": "código_encontrado",
  "valor": valor_numerico
}

Se não encontrar, responda: null
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      });

      const resultado = response.choices[0].message.content.trim();
      console.log(`   🤖 ATACADO: Resposta da IA: ${resultado}`);

      if (resultado === 'null') {
        return null;
      }

      const dados = JSON.parse(resultado);
      
      if (dados && dados.referencia && dados.valor) {
        console.log(`   ✅ ATACADO: Comprovante válido - Ref: ${dados.referencia}, Valor: ${dados.valor}MT`);
        return {
          referencia: dados.referencia,
          valor: parseFloat(dados.valor)
        };
      }

      return null;

    } catch (error) {
      console.error('❌ ATACADO: Erro na análise do comprovante:', error);
      return null;
    }
  }

  // === FUNÇÃO PRINCIPAL PARA O BOT (CÓDIGO ORIGINAL) ===
  async processarMensagemBot(mensagem, remetente, tipoMensagem = 'texto', configGrupo = null, legendaImagem = null) {
    const timestamp = Date.now();
    
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

  // === PROCESSAR TEXTO (CÓDIGO ORIGINAL) ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo = null) {
    console.log(`   📝 ATACADO: Analisando mensagem: "${mensagem}"`);
    
    const mensagemLimpa = mensagem.trim();
    const apenasNumeroRegex = /^(?:\+258\s*)?8[0-9]{8}$/;
    
    if (apenasNumeroRegex.test(mensagemLimpa)) {
      const numeroLimpo = this.limparNumero(mensagemLimpa);
      console.log(`   📱 ATACADO: Detectado número isolado: ${numeroLimpo} (original: ${mensagemLimpa})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    const resultado = this.separarComprovanteENumero(mensagem);
    
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
    
    let comprovante = null;
    if (textoComprovante && textoComprovante.length > 10) {
      comprovante = await this.analisarComprovante(textoComprovante);
    }
    
    if (comprovante && numero) {
      console.log(`   🎯 ATACADO: COMPROVANTE + NÚMERO na mesma mensagem!`);
      console.log(`   💰 ATACADO: Comprovante: ${comprovante.referencia} - ${comprovante.valor}MT`);
      console.log(`   📱 ATACADO: Número: ${numero}`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const numeroLimpo = this.limparNumero(numero);
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numeroLimpo}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numeroLimpo,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }
    
    if (numero && !comprovante) {
      const numeroLimpo = this.limparNumero(numero);
      console.log(`   📱 ATACADO: Apenas número detectado: ${numeroLimpo} (original: ${numero})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    if (comprovante && !numero) {
      console.log(`   💰 ATACADO: Apenas comprovante detectado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
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
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }
    
    console.log(`   ❓ ATACADO: Mensagem não reconhecida como comprovante ou número`);
    return { 
      sucesso: false, 
      tipo: 'mensagem_nao_reconhecida',
      mensagem: null 
    };
  }

  // === PROCESSAMENTO DE IMAGEM MELHORADO ===
  async processarImagem(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   📸 ATACADO: Processando imagem de ${remetente} com IA melhorada`);
    
    const temLegendaValida = legendaImagem && 
                            typeof legendaImagem === 'string' && 
                            legendaImagem.trim().length > 0;
    
    if (temLegendaValida) {
      console.log(`   📝 ATACADO: Legenda detectada: "${legendaImagem.trim()}"`);
    }

    const promptMelhorado = `
ANALISE esta imagem de comprovante M-Pesa/E-Mola de Moçambique.

⚠️ ATENÇÃO CRÍTICA - REFERÊNCIAS QUEBRADAS EM MÚLTIPLAS LINHAS:

🟡 FORMATO E-MOLA ESPECÍFICO - PADRÃO OBRIGATÓRIO:
PP + 6 dígitos + . + 4 dígitos + . + mínimo 5 caracteres
Exemplo: PP250820.1706.e9791O (PP + 250820 + . + 1706 + . + e9791O)

⚠️ CRÍTICO: Referências E-Mola seguem padrão rígido:
1. Começam com PP (2 letras)
2. Seguido de 6 dígitos (data)
3. Ponto (.)
4. Seguido de 4 dígitos (hora)  
5. Ponto (.)
6. Seguido de 5+ caracteres alfanuméricos (código único)

EXEMPLOS CORRETOS E-MOLA:
- "PP250820.1706.e9791O" (PP + 6 dígitos + 4 dígitos + 6 caracteres)
- "PP250821.1152.E58547" (PP + 6 dígitos + 4 dígitos + 6 caracteres)
- "EP240815.1420.h45672" (EP + 6 dígitos + 4 dígitos + 6 caracteres)

🚨 SE ENCONTRAR E-MOLA INCOMPLETO, PROCURE MAIS CARACTERES!
Exemplo: Se você vê "PP250820.1706.e9791" mas na linha seguinte tem "O"
RESULTADO CORRETO: "PP250820.1706.e9791O"

🔵 M-PESA (SEM pontos):
⚠️ CRÍTICO: MANTENHA maiúsculas e minúsculas EXATAMENTE como aparecem!
Se você vê:
"CHK8H3PYK" + "pe" (em linhas separadas)
RESULTADO: "CHK8H3PYKpe" (EXATO - não mude para maiúsculo!)

🔍 INSTRUÇÕES DE BUSCA:
1. Procure por "ID da transação" ou "Confirmado"
2. Abaixo/ao lado, encontre o código
3. Para E-Mola: SEMPRE tem 3 partes separadas por pontos
4. Para M-Pesa: código alfanumérico sem pontos
5. SE estiver quebrado em linhas, JUNTE TUDO!
6. ⚠️ CRÍTICO: MANTENHA maiúsculas e minúsculas EXATAMENTE como aparecem!

VALOR: Procure valor em MT (ex: "375.00MT")

Responda no formato JSON:
{
  "referencia": "código_completo_encontrado",
  "valor": valor_numerico_sem_mt
}

Se não encontrar dados válidos, responda: null
`;

    try {
      // Primeiro, tentar extrair número da legenda se existir
      let numeroLegenda = null;
      if (temLegendaValida) {
        numeroLegenda = this.extrairNumeroDeLegenda(legendaImagem);
        if (numeroLegenda && numeroLegenda.multiplos) {
          return {
            sucesso: false,
            tipo: 'multiplos_numeros_legenda',
            numeros: numeroLegenda.numeros,
            mensagem: 'Múltiplos números detectados na legenda. Sistema aceita apenas UM número por vez.'
          };
        }
      }

      // Processar a imagem com IA
      console.log(`   🤖 ATACADO: Enviando imagem para análise com IA...`);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptMelhorado },
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

      const resultado = response.choices[0].message.content.trim();
      console.log(`   🤖 ATACADO: Resposta da IA para imagem: ${resultado}`);

      if (resultado === 'null' || resultado.toLowerCase().includes('null')) {
        console.log(`   ❌ ATACADO: IA não conseguiu extrair dados da imagem`);
        
        if (numeroLegenda) {
          console.log(`   📱 ATACADO: Processando apenas número da legenda: ${numeroLegenda}`);
          return await this.processarNumero(numeroLegenda, remetente, timestamp, configGrupo);
        }
        
        return {
          sucesso: false,
          tipo: 'imagem_nao_reconhecida',
          mensagem: 'Não foi possível ler o comprovante na imagem. Tente enviar uma foto mais clara ou digite os dados manualmente.'
        };
      }

      // Parse do resultado JSON
      let dadosComprovante;
      try {
        dadosComprovante = JSON.parse(resultado);
      } catch (parseError) {
        console.log(`   ❌ ATACADO: Erro ao fazer parse do JSON: ${parseError.message}`);
        
        if (numeroLegenda) {
          return await this.processarNumero(numeroLegenda, remetente, timestamp, configGrupo);
        }
        
        return {
          sucesso: false,
          tipo: 'erro_processamento_imagem',
          mensagem: 'Erro no processamento da imagem. Tente novamente.'
        };
      }

      if (!dadosComprovante || !dadosComprovante.referencia || !dadosComprovante.valor) {
        console.log(`   ❌ ATACADO: Dados inválidos extraídos da imagem`);
        
        if (numeroLegenda) {
          return await this.processarNumero(numeroLegenda, remetente, timestamp, configGrupo);
        }
        
        return {
          sucesso: false,
          tipo: 'dados_invalidos_imagem',
          mensagem: 'Dados do comprovante não foram encontrados na imagem.'
        };
      }

      console.log(`   ✅ ATACADO: Comprovante extraído da imagem: ${dadosComprovante.referencia} - ${dadosComprovante.valor}MT`);

      const comprovante = {
        referencia: dadosComprovante.referencia,
        valor: parseFloat(dadosComprovante.valor)
      };

      // Se tem número na legenda, processar completo
      if (numeroLegenda) {
        console.log(`   🎯 ATACADO: IMAGEM + NÚMERO na legenda!`);
        
        const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
        
        if (megasCalculados) {
          const numeroLimpo = this.limparNumero(numeroLegenda);
          const resultadoCompleto = `${comprovante.referencia}|${megasCalculados.megas}|${numeroLimpo}`;
          console.log(`   ✅ ATACADO: PEDIDO COMPLETO VIA IMAGEM: ${resultadoCompleto}`);
          
          return {
            sucesso: true,
            dadosCompletos: resultadoCompleto,
            tipo: 'numero_processado',
            numero: numeroLimpo,
            megas: megasCalculados.megas,
            valorPago: comprovante.valor,
            origem: 'imagem_com_legenda'
          };
        } else {
          return {
            sucesso: false,
            tipo: 'valor_nao_encontrado_na_tabela',
            valor: comprovante.valor,
            mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
          };
        }
      }

      // Apenas comprovante da imagem
      console.log(`   💰 ATACADO: Apenas comprovante extraído da imagem`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        await this.processarComprovante(comprovante, remetente, timestamp);
        
        return {
          sucesso: true,
          tipo: 'comprovante_recebido',
          referencia: comprovante.referencia,
          valor: comprovante.valor,
          megas: megasCalculados.megas,
          mensagem: `✅ *COMPROVANTE RECEBIDO!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT = ${megasCalculados.megas}\n\n📱 Agora envie UM número que vai receber os megas`,
          origem: 'imagem'
        };
      } else {
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }

    } catch (error) {
      console.error('❌ ATACADO: Erro no processamento da imagem:', error);
      
      // Fallback: tentar processar apenas o número da legenda
      if (numeroLegenda) {
        console.log(`   🔄 ATACADO: Fallback - processando número da legenda após erro`);
        return await this.processarNumero(numeroLegenda, remetente, timestamp, configGrupo);
      }
      
      return {
        sucesso: false,
        tipo: 'erro_processamento_imagem',
        mensagem: 'Erro no processamento da imagem. Tente novamente ou envie os dados por texto.',
        erro: error.message
      };
    }
  }
}

module.exports = WhatsAppAIAtacado;
