export interface LibraryItem {
  name: string;
  objective?: string;
  intensity?: string;
  rpe?: string;
  conversation?: string;
  duration?: string;
  usage?: string;
  example?: string;
  details?: string;
  execution?: string;
  sets?: string;
  alternatives?: string;
  points?: string[];
  fallbacks?: {
    title: string;
    situations: Array<{ cond: string; sol: string }>;
  };
  variations?: string;
  caution?: string;
  tips?: string;
  principles?: string;
  metrics?: string;
}

export interface LibraryCategory {
  id: string;
  title: string;
  description: string;
  items: LibraryItem[];
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    id: "corridas_continuas",
    title: "1. Corridas Contínuas",
    description: "Métodos de treino contínuo voltados para base aeróbica, economia de corrida e regeneração ativa.",
    items: [
      {
        name: "1.1 Rodagem Regenerativa",
        objective: "Promover recuperação ativa com baixo estresse fisiológico e remoção de metabólitos pós-esforço.",
        intensity: "Muito leve",
        rpe: "RPE 2-3 / 10",
        conversation: "Extremamente fácil (conversa sem qualquer interrupção)",
        duration: "20 a 60 minutos",
        usage: "Após treinos intensos (como intervalados) ou em semanas de maior fadiga acumulada.",
        example: "30 minutos em ritmo confortável de trote regenerativo, sem qualquer preocupação com pace."
      },
      {
        name: "1.2 Rodagem Leve / Zona 2",
        objective: "Desenvolver a base aeróbica primária, capilarização muscular, densidade mitocondrial e aumentar a capacidade de sustentar esforço prolongado utilizando gordura como fonte de energia.",
        intensity: "Leve",
        rpe: "RPE 3-4 / 10",
        conversation: "Fácil (consegue falar frases completas tranquilamente)",
        duration: "30 a 75 minutos",
        usage: "Treino fundamental e mais frequente em qualquer fase de periodização.",
        example: "45 a 60 minutos em ritmo confortável e controlado (Zona de Frequência Cardíaca 2)."
      },
      {
        name: "1.3 Rodagem Moderada",
        objective: "Desenvolver resistência aeróbica em ritmo mais firme com uma carga cardiovascular maior que a rodagem leve, treinando ritmo constante.",
        intensity: "Moderada",
        rpe: "RPE 4-5 / 10",
        conversation: "Conversação exige atenção (fala apenas algumas frases seguidas)",
        duration: "40 a 80 minutos",
        usage: "Usar com cuidado na semana para não transformar todos os treinos em moderadamente difíceis.",
        example: "50 minutos em ritmo constante, visivelmente mais rápido e ativo que a rodagem leve."
      },
      {
        name: "1.4 Corrida Progressiva",
        objective: "Aprender a controlar o esforço, ativar sistemas metabólicos de forma crescente e terminar mais rápido sem começar excessivamente forte.",
        intensity: "Crescente (Leve a Forte)",
        rpe: "RPE 3 a 7 / 10",
        conversation: "Começa muito fácil e termina difícil",
        duration: "40 a 60 minutos",
        usage: "Excelente para simular progressão de esforço em provas e ensinar disciplina tática.",
        example: "40 min totais divididos em: 15 min leve + 15 min moderado + 10 min forte controlado (sem sprintar)."
      },
      {
        name: "1.5 Longão (Long Run)",
        objective: "Desenvolver resistência física e mental crônica, tolerância muscular ao impacto prolongado, eficiência energética celular e testar estratégias de hidratação e alimentação.",
        intensity: "Leve a Moderada",
        rpe: "RPE 3-4 / 10",
        conversation: "Fácil (consegue conversar durante a maior parte do tempo)",
        duration: "75 a 150 minutos (ou mais dependendo da prova alvo)",
        usage: "Realizado uma vez por semana, geralmente no final de semana.",
        example: "90 minutos em ritmo confortável e constante."
      },
      {
        name: "1.6 Longão Progressivo",
        objective: "Combinar resistência extrema com controle de ritmo fino sob fadiga neuromuscular instalada.",
        intensity: "Crescente progressivo",
        rpe: "RPE 3 a 7 / 10",
        conversation: "Fácil no início, evoluindo para fala em frases curtas no final",
        duration: "80 a 120 minutos",
        usage: "Treino específico para atletas experientes em preparação para maratonas.",
        example: "90 min totais divididos em: 60 min leves + 20 min moderados + 10 min em ritmo controladamente forte."
      }
    ]
  },
  {
    id: "treinos_intensidade",
    title: "2. Treinos de Intensidade",
    description: "Estímulos acima do limiar aeróbico voltados para o aumento do VO2 Máximo, velocidade e tolerância ao lactato.",
    items: [
      {
        name: "2.1 Intervalado (Speedwork)",
        objective: "Desenvolver velocidade, capacidade de VO2 Máximo, tolerância ao esforço de alta intensidade e economia de corrida em ritmos de prova rápidos.",
        intensity: "Forte a Muito Forte",
        rpe: "RPE 8-9 / 10",
        conversation: "Extremamente difícil (fala apenas monossílabos)",
        duration: "Varia (blocos de 200m a 1200m)",
        usage: "Fases preparatórias e específicas de velocidade.",
        example: "10 min aquecimento + 6 × 400m forte (RPE 8-9) com 200m de trote regenerativo de recuperação entre repetições + 10 min desaquecimento."
      },
      {
        name: "2.2 Tiros Curtos (Sprints)",
        objective: "Aprimorar técnica neuromuscular, recrutamento de fibras do tipo II, coordenação motora, potência mecânica e velocidade pura.",
        intensity: "Máxima ou Submáxima",
        rpe: "RPE 9-10 / 10",
        conversation: "Impossível conversar durante a execução",
        duration: "8 a 30 segundos por repetição",
        usage: "Trabalho técnico e de ativação neuromuscular.",
        example: "10 × 100m em esforço máximo controlado com recuperação completa (caminhada ou parado até baixar o RHR) entre os tiros."
      },
      {
        name: "2.3 Repetições Longas (Intervalados Longos)",
        objective: "Aumentar a capacidade de sustentar ritmos elevados e eficientes por longos períodos (tolerância ao estresse de limiar).",
        intensity: "Forte e Controlado",
        rpe: "RPE 7-8 / 10",
        conversation: "Fala apenas palavras soltas",
        duration: "Blocos de 3 a 10 minutos (1km a 3km)",
        usage: "Específico para provas de 10k, Meia e Maratona.",
        example: "4 × 1 km no ritmo planejado de 10k, com recuperação ativa de 2 a 3 minutos entre os blocos."
      },
      {
        name: "2.4 Tempo Run (Corrida de Ritmo)",
        objective: "Corrida contínua para aumentar o limiar de lactato, permitindo correr mais rápido com menor fadiga metabólica.",
        intensity: "Firme e Confortavelmente Difícil",
        rpe: "RPE 6-7 / 10",
        conversation: "Frases muito curtas",
        duration: "15 a 40 minutos contínuos",
        usage: "Aumento de força e resistência mental no ritmo de limiar.",
        example: "15 min leve de aquecimento + 20 min em ritmo firme controlado (RPE 7) + 10 min trote leve de desaquecimento."
      },
      {
        name: "2.5 Treino de Limiar (Threshold)",
        objective: "Trabalhar no ponto exato onde o lactato começa a se acumular rapidamente no sangue. Melhora a eficiência cardíaca.",
        intensity: "Firme",
        rpe: "RPE 7 / 10",
        conversation: "Limiar de fala",
        duration: "20 a 45 minutos contínuos ou fracionados",
        usage: "Aumentar a velocidade de cruzeiro aeróbico do atleta.",
        example: "Fracionado: 3 × 8 minutos em ritmo de limiar com 2 minutos de caminhada de recuperação entre as repetições."
      },
      {
        name: "2.6 Fartlek",
        objective: "Alternância lúdica e flexível de ritmos, ensinando o corpo a acelerar e recuperar de forma dinâmica em condições variadas.",
        intensity: "Variável (Leve a Muito Forte)",
        rpe: "RPE 3 a 9 / 10",
        conversation: "Alterna momentos fáceis e extremamente difíceis",
        duration: "30 a 50 minutos",
        usage: "Excelente em períodos de transição ou pré-temporada por reduzir o estresse mental de cronômetros.",
        example: "Corrida de 40 min alternando: 1 min forte, 2 min leve, 2 min forte, 2 min leve, 3 min forte, 3 min leve (repetir sequência)."
      },
      {
        name: "2.7 Ritmo de Prova (Target Pace)",
        objective: "Consolidar o ritmo tático e a biomecânica exata que o atleta planeja sustentar na prova alvo, melhorando a percepção específica.",
        intensity: "Específica da Prova",
        rpe: "Variável (conforme distância da prova)",
        conversation: "Exige foco para manter o ritmo constante",
        duration: "Varia de acordo com a meta",
        usage: "Fases de polimento e semanas pré-competitivas.",
        example: "Para prova de 10k: 15 min leve + 3 × 2 km no ritmo planejado para a prova com 3 min de trote entre os blocos + desaquecimento."
      },
      {
        name: "2.8 Treino de Subida (Uphills)",
        objective: "Desenvolver força específica nas pernas, melhorar a mecânica da passada (apoio do antepé) e aumentar a exigência cardiovascular com menor impacto articular.",
        intensity: "Muito Forte",
        rpe: "RPE 8-9 / 10",
        conversation: "Esforço cardiorrespiratório elevado",
        duration: "Subidas de 30 a 90 segundos",
        usage: "Período de base e fortalecimento neuromuscular.",
        example: "8 × 45 segundos correndo forte em subida de inclinação moderada, retornando ao início caminhando/trotando para recuperar."
      },
      {
        name: "2.9 Sprint em Subida (Hill Sprints)",
        objective: "Desenvolver potência muscular pura, ativação de fibras rápidas, rigidez do tendão de Aquiles (tendon stiffness) e técnica de corrida de forma segura.",
        intensity: "Máxima Explosão",
        rpe: "RPE 10 / 10",
        conversation: "Impossível falar",
        duration: "8 a 12 segundos por repetição",
        usage: "Após treinos leves de rodagem para recrutamento muscular puro.",
        example: "6 a 10 tiros de 10 segundos em subida íngreme com esforço máximo. Recuperação total de 90 segundos caminhando de volta."
      }
    ]
  },
  {
    id: "educativos_tecnicos",
    title: "3. Treinos Técnicos e Educativos",
    description: "Exercícios que aprimoram a coordenação motora, postura, eficiência do ciclo de corrida e reduzem o tempo de contato com o solo.",
    items: [
      {
        name: "3.1 Skipping Baixo (Low Skip)",
        objective: "Aprimorar a coordenação motora fina dos tornozelos, frequência de passadas e reatividade do pé no solo.",
        intensity: "Leve e Rápido",
        rpe: "RPE 3-4 / 10",
        details: "Dar passos extremamente curtos e rápidos, movimentando os tornozelos com o joelho subindo muito pouco. Tronco ereto e braços coordenados.",
        duration: "2 a 3 séries de 20 metros",
        usage: "Sempre na transição entre o aquecimento e o treino principal."
      },
      {
        name: "3.2 Skipping Alto (High Skip)",
        objective: "Trabalhar a elevação de joelhos (fase de balanço), fortalecimento de flexores do quadril e postura do tronco ereto.",
        intensity: "Moderada",
        rpe: "RPE 5-6 / 10",
        details: "Elevação alternada dos joelhos até a linha do quadril (90 graus), com tronco estável e apoio ativo na planta do pé (antepé). Evitar inclinar o tronco para trás.",
        duration: "2 a 3 séries de 20 metros",
        usage: "Durante rotinas de técnica de corrida pré-treino."
      },
      {
        name: "3.3 Anfersen (Calcanhar no Glúteo)",
        objective: "Aprimorar a fase de recuperação da passada (retorno do calcanhar), coordenação neuromuscular e flexibilidade dinâmica do quadríceps.",
        intensity: "Leve a Moderada",
        rpe: "RPE 4 / 10",
        details: "Deslocar-se elevando os calcanhares em direção aos glúteos de forma alternada e contínua. Manter joelhos apontados para baixo e tronco ligeiramente inclinado à frente.",
        duration: "2 a 3 séries de 20 metros",
        usage: "Educativo clássico de coordenação biomecânica."
      },
      {
        name: "3.4 Dribling (Pés Rápidos)",
        objective: "Trabalhar a articulação de tornozelo (calcanhar-planta-ponta), coordenação rápida dos membros e consciência postural do apoio.",
        intensity: "Leve e Neuromuscular",
        rpe: "RPE 3 / 10",
        details: "Passos extremamente curtos e rápidos, quase no mesmo lugar, fazendo um rolamento completo do pé, mantendo o joelho destravado e relaxado.",
        duration: "2 a 3 séries de 20 metros",
        usage: "Ótimo para iniciar a preparação de articulações do pé e tornozelo."
      },
      {
        name: "3.5 Corrida com Elevação de Joelhos (Aceleração)",
        objective: "Coordenar a transição entre o movimento educativo estrito e a mecânica real de aceleração em corrida.",
        intensity: "Moderada a Firme",
        rpe: "RPE 5-6 / 10",
        details: "Iniciar o skipping alto parado ou com leve deslocamento e, progressivamente, soltar o corpo em corrida mantendo a amplitude de quadril por alguns metros.",
        duration: "2 a 3 séries de 30 metros",
        usage: "Excelente preparador para treinos de tiros ou ritmos firmes."
      },
      {
        name: "3.6 Strides / Progressivos",
        objective: "Melhorar a coordenação em alta velocidade, alongar a passada e recrutar fibras de contração rápida antes do treino principal de velocidade.",
        intensity: "Submáxima Progressiva",
        rpe: "RPE 7-8 / 10",
        details: "Acelerações curtas e lineares de 15 a 30 segundos. Começar leve e atingir cerca de 85% da velocidade máxima no meio, estabilizando e desacelerando de forma suave.",
        duration: "4 a 6 repetições de 50 a 80 metros, recuperando totalmente com caminhada de retorno.",
        usage: "Rotina essencial antes de treinos de intervalados ou tiros."
      }
    ]
  },
  {
    id: "forca_fortalecimento",
    title: "4. Treinamento de Força Funcional",
    description: "Exercícios de reforço muscular para quadril, core e membros inferiores, cruciais para estabilidade da passada e prevenção de lesões comuns (canelite, joelho do corredor, etc).",
    items: [
      {
        name: "4.1 Agachamento (Squat)",
        objective: "Fortalecer quadríceps, glúteos, adutores e estabilizadores do tronco, proporcionando força basal e melhora na absorção de impacto.",
        execution: "Com peso corporal, halteres, mochila ou barra. Agachar mantendo o alinhamento de joelhos com as pontas dos pés, ativando o abdômen e mantendo a coluna neutra.",
        sets: "3 séries de 10 a 15 repetições",
        alternatives: "Ajustar amplitude se houver desconforto nos joelhos."
      },
      {
        name: "4.2 Agachamento Unilateral (Bulgarian Split Squat)",
        objective: "Melhorar a estabilidade unilateral de quadril e joelho, corrigir assimetrias de força e recrutar intensamente glúteo médio e quadríceps (essencial, pois a corrida é uma sucessão de apoios unilaterais).",
        execution: "Apoiar um pé atrás em um banco ou degrau elevado, dar um passo à frente com a outra perna e agachar verticalmente. Manter o joelho da frente alinhado.",
        sets: "3 séries de 8 a 12 repetições por perna",
        alternatives: "Split Squat tradicional com os dois pés no solo para iniciantes."
      },
      {
        name: "4.3 Passada / Avanço (Lunge / Walking Lunge)",
        objective: "Fortalecer cadeia anterior e posterior de forma dinâmica, simulando o vetor de força da passada de corrida.",
        execution: "Dar um passo à frente flexionando o joelho a 90 graus, mantendo o tronco ereto e o joelho de trás quase tocando o solo. Retornar ou caminhar avançando.",
        sets: "3 séries de 12 a 16 passos alternados",
        alternatives: "Avanço para trás (Reverse Lunge), que gera menor estresse patelofemoral."
      },
      {
        name: "4.4 Step-Up (Subida no Banco)",
        objective: "Fortalecer intensamente glúteo máximo, quadríceps e controle de alinhamento dinâmico de tornozelo-joelho-quadril.",
        execution: "Subir em uma plataforma firme ou degrau alto, estendendo completamente o quadril em cima, elevando o outro joelho a 90 graus. Descer de forma controlada.",
        sets: "3 séries de 10 repetições por perna",
        alternatives: "Reduzir a altura da plataforma para facilitar o controle dinâmico."
      },
      {
        name: "4.5 Stiff (Romanian Deadlift)",
        objective: "Fortalecer isquiotibiais (posteriores de coxa) e glúteos na fase excêntrica, fundamentais para a frenagem da perna e propulsão traseira na corrida.",
        execution: "Com halteres ou mochila. Flexionar levemente os joelhos e empurrar o quadril para trás, descendo a carga rente às pernas mantendo a coluna reta e firme. Retornar contraindo os glúteos.",
        sets: "3 séries de 10 a 12 repetições",
        alternatives: "Stiff Unilateral (peso corporal) para trabalhar equilíbrio e propriocepção."
      },
      {
        name: "4.6 Levantamento Terra (Deadlift)",
        objective: "Trabalho de força global da cadeia posterior, eretores da espinha e pegada, promovendo solidez estrutural geral.",
        execution: "Pés na largura do quadril, segurar a barra ou halteres pesados. Empurrar o chão com os pés e subir estendendo quadril e joelhos de forma síncrona.",
        sets: "3 séries de 6 a 10 repetições (com foco em controle)",
        alternatives: "Levantamento Terra com halteres ou Kettlebell."
      },
      {
        name: "4.7 Elevação de Panturrilha (Calf Raises)",
        objective: "Fortalecer gastrocnêmio e sóleo, estabilizar o tornozelo e aumentar a potência de impulsão (a panturrilha absorve até 8 vezes o peso corporal por passada).",
        execution: "Em pé na borda de um degrau (unilateral ou bilateral). Descer o calcanhar abaixo da linha do degrau para alongar e subir até a extensão máxima dos dedos.",
        sets: "3 séries de 15 a 20 repetições (focar na fase de descida lenta)",
        alternatives: "Elevação sentada (ativando mais o músculo sóleo)."
      },
      {
        name: "4.8 Ponte de Glúteo (Glute Bridge)",
        objective: "Ativar e fortalecer os glúteos e eretores da coluna, fundamentais para manter a bacia nivelada durante a fadiga na corrida.",
        execution: "Deitado de costas, joelhos dobrados e pés apoiados no chão. Elevar o quadril contraindo os glúteos até formar uma linha reta dos joelhos aos ombros.",
        sets: "3 séries de 12 a 15 repetições",
        alternatives: "Ponte de glúteo unilateral para maior dificuldade e correção de desequilíbrios."
      },
      {
        name: "4.9 Hip Thrust (Elevação Pélvica Apoiada)",
        objective: "Exercício padrão-ouro para hipertrofia e desenvolvimento de força máxima e potência de glúteos na extensão de quadril.",
        execution: "Apoiar as escápulas em um banco, colocar uma barra ou peso sobre o quadril e realizar a extensão pélvica empurrando com os calcanhares.",
        sets: "3 séries de 8 a 12 repetições com carga progressiva",
        alternatives: "Ponte unilateral com o tronco elevado."
      },
      {
        name: "4.10 Abdução de Quadril (Clamshell)",
        objective: "Fortalecer o glúteo médio, músculo responsável por evitar a queda do quadril oposto na corrida (valgo dinâmico de joelho).",
        execution: "Deitado de lado com joelhos dobrados. Manter calcanhares unidos e abrir o joelho superior. Pode usar miniband acima dos joelhos.",
        sets: "3 séries de 15 a 20 repetições por perna",
        alternatives: "Abdução lateral de perna estendida ou Monster Walks."
      }
    ]
  },
  {
    id: "core_estabilidade",
    title: "5. Core e Estabilidade",
    description: "Musculatura estabilizadora profunda do tronco, essencial para reter energia elástica na passada, prevenir dor lombar e estabilizar a pélvis.",
    items: [
      {
        name: "5.1 Prancha (Plank)",
        objective: "Desenvolver resistência isométrica dos flexores e estabilizadores profundos do tronco.",
        execution: "Prancha Frontal (antebaços apoiados no chão, corpo alinhado e contraído sem deixar o quadril cair) ou Prancha Lateral (foco nos oblíquos e glúteo médio).",
        sets: "3 séries de 30 a 60 segundos",
        variations: "Prancha dinâmica tocando os ombros alternadamente para introduzir anti-rotação."
      },
      {
        name: "5.2 Dead Bug (Inseto Morto)",
        objective: "Estabilização do core profundo em dissociação de membros, ensinando a estabilizar a coluna lombar enquanto braços e pernas se movem.",
        execution: "Deitado de costas com joelhos a 90 graus e braços apontando para o teto. Estender lentamente o braço direito e a perna esquerda até quase tocar o chão, mantendo a lombar pressionando o solo de forma ativa. Retornar e alternar.",
        sets: "3 séries de 10 a 12 repetições controladas",
        variations: "Fazer o movimento segurando uma bola suíça entre joelhos e mãos."
      },
      {
        name: "5.3 Bird Dog (Cão de Caça)",
        objective: "Fortalecimento integrado dos eretores da espinha, multífidos e glúteos de forma simétrica e segura.",
        execution: "Em quatro apoios. Estender simultaneamente um braço à frente e a perna oposta atrás até alinharem com o tronco. Manter o quadril paralelo ao chão por 2s e retornar de forma coordenada.",
        sets: "3 séries de 12 a 16 repetições alternadas",
        variations: "Realizar pequenos círculos com o braço e a perna estendidos antes de retornar."
      },
      {
        name: "5.4 Pallof Press (Pressione de Pallof)",
        objective: "Desenvolver força anti-rotacional excelente para estabilizar o tronco contra os movimentos de oscilação lateral da corrida.",
        execution: "Segurar um elástico (miniband presa) ou cabo lateralmente na altura do peito. Empurrar os braços à frente sem permitir que o tronco rotacione ou sofra desvio lateral. Retornar lentamente.",
        sets: "3 séries de 12 repetições de cada lado",
        variations: "Pallof press em base de lunge (joelho fora do solo) para aumentar a demanda de quadril."
      }
    ]
  },
  {
    id: "pliometria_potencia",
    title: "6. Pliometria e Potência",
    description: "Treinos focados no ciclo de alongamento-encurtamento muscular, essenciais para reatividade no contato com o solo e impulsão mecânica.",
    items: [
      {
        name: "6.1 Saltos Verticais (Vertical Jumps)",
        objective: "Melhorar a taxa de desenvolvimento de força (RFD) e potência de tripla extensão (tornozelo, joelho e quadril).",
        execution: "Realizar um agachamento rápido a 90 graus e saltar verticalmente com máxima potência. Amortecer a queda de forma suave dobrando os joelhos.",
        sets: "3 séries de 6 a 8 repetições (priorizar máxima velocidade e qualidade)",
        caution: "Introduzir apenas após consolidar uma base de força geral de pelo menos 4 a 6 semanas."
      },
      {
        name: "6.2 Saltos Horizontais (Broad Jumps)",
        objective: "Trabalhar a produção de força na direção horizontal (vetor de deslocamento principal da corrida).",
        execution: "Flexionar levemente o quadril e saltar à frente com os dois pés de forma explosiva, buscando distância com aterrissagem controlada e estável em base de agachamento.",
        sets: "3 séries de 5 a 6 repetições",
        caution: "Garantir solo plano e não escorregadio."
      },
      {
        name: "6.3 Saltos Unilaterais (Single-Leg Bounds)",
        objective: "Desenvolver força reativa de impulsão unilateral específica, simulando uma corrida com saltos exagerados em amplitude.",
        execution: "Saltar de uma perna para a otra projetando o corpo à frente e para cima, coordenando os braços ativos. Amortecer e empurrar o chão de forma reativa com o pé.",
        sets: "3 séries de 15 a 20 metros",
        caution: "Exercício avançado de alto impacto. Usar com moderação em grama ou pista de atletismo."
      },
      {
        name: "6.4 Saltos Reativos (Ankle Hops)",
        objective: "Reduzir o tempo de contato com o solo (GCT), otimizando a elasticidade do tendão de Aquiles.",
        execution: "Saltar no mesmo lugar utilizando apenas a articulação do tornozelo, mantendo joelhos quase estendidos (rígidos). Tocar o chão e saltar o mais rápido possível.",
        sets: "3 séries de 20 a 30 segundos",
        caution: "Excelente para corredores que buscam melhorar ritmos de tiros curtos e 5k."
      }
    ]
  },
  {
    id: "mobilidade_alongamento",
    title: "7. Mobilidade",
    description: "Preservar a amplitude articular funcional necessária para uma passada fluida, reduzindo as tensões assimétricas e prevenindo encurtamentos graves.",
    items: [
      {
        name: "7.1 Mobilidade de Tornozelo (Dorsiflexão)",
        objective: "Melhorar o ângulo de inclinação da canela à frente (dorsiflexão), crucial para um agachamento profundo e amortecimento eficiente da passada.",
        execution: "Ficar de frente para uma parede com o pé a alguns centímetros dela. Empurrar o joelho à frente tentando tocar a parede sem tirar o calcanhar do chão.",
        sets: "2 a 3 séries de 10 a 12 movimentos dinâmicos por tornozelo.",
        tips: "Ótimo antes de correr ou agachar."
      },
      {
        name: "7.2 Mobilidade de Quadril (Rotação e Flexão)",
        objective: "Destravar a articulação coxofemoral para permitir uma melhor extensão de quadril na fase traseira da passada, poupando a coluna lombar.",
        execution: "Mobilidade 90/90 (sentado com joelhos flexionados a 90 graus para lados opostos, rotacionar o quadril alternando as pernas de lado sem usar as mãos de apoio se possível) e alongamento dinâmico de flexor de quadril.",
        sets: "2 séries de 10 movimentos controlados.",
        tips: "Ideal para manter a bacia solta e prevenir encurtamentos."
      },
      {
        name: "7.3 Mobilidade Torácica",
        objective: "Melhorar a rotação e extensão da coluna torácica, garantindo uma postura ereta, melhorando a expansão pulmonar e liberando o balanço dos braços.",
        execution: "Gato/Camelo (quatro apoios, alternar entre curvar a espinha para cima e para baixo olhando para o peito e teto) ou Rotação torácica em quatro apoios.",
        sets: "2 séries de 10 repetições.",
        tips: "Essencial para atletas que passam muito tempo sentados."
      },
      {
        name: "7.4 Alongamento Dinâmico (Warm-up Ativo)",
        objective: "Preparar a musculatura de forma ativa aumentando a temperatura corporal local e lubrificação articular antes da corrida.",
        execution: "Balanços de perna (laterais e frontais segurando em apoio para soltar adutores e isquiotibiais) e Avanço Dinâmico caminhando com leve rotação de tronco.",
        sets: "1 a 2 séries de 10 balanços por perna.",
        tips: "Substitui alongamentos estáticos prolongados no pré-treino."
      }
    ]
  },
  {
    id: "recuperacao_regeneracao",
    title: "8. Recuperação & Regeneração",
    description: "Métodos cruciais para supercompensação fisiológica, garantindo que o atleta absorva a carga de treino imposta sem entrar em overtraining.",
    items: [
      {
        name: "8.1 Descanso Completo (Rest Day / Day Off)",
        objective: "Permitir restauração celular do tecido muscular, reabastecimento completo de estoques de glicogênio hepático/muscular e descanso mental total.",
        duration: "24 a 36 horas sem atividade estruturada",
        usage: "Obrigatório pelo menos uma vez por semana na maioria das planilhas de amadores.",
        principles: "Evitar atividades físicas intensas ou caminhadas excessivamente longas."
      },
      {
        name: "8.2 Corrida Regenerativa",
        objective: "Estimular o fluxo sanguíneo muscular sem gerar microlesões ou estresse metabólico, acelerando a drenagem de resíduos celulares.",
        duration: "20 a 45 minutos em ritmo extremamente leve",
        usage: "No dia seguinte a treinos exaustivos (longão ou intervalado forte).",
        principles: "O pace deve ser ignorado. Foco exclusivo na sensação de relaxamento total."
      },
      {
        name: "8.3 Caminhada Ativa",
        objective: "Manter atividade física de baixíssimo estresse mecânico e mental, excelente para a saúde cardiovascular de base e mobilidade suave.",
        duration: "30 a 60 minutos em ritmo relaxado",
        usage: "Substituto para dias de rodagem quando o atleta apresenta fadiga crônica ou leve desconforto mecânico.",
        principles: "Pode ser feita em locais arborizados ou praias para descompressão mental."
      },
      {
        name: "8.4 Mobilidade Leve",
        objective: "Aliviar tensões fasciais musculares agudas após treinos, promovendo alongamento dinâmico sem impacto.",
        duration: "15 a 30 minutos de posições suaves",
        usage: "No final de semana ou após dias estressantes.",
        principles: "Não forçar alongamentos ao ponto de dor aguda."
      },
      {
        name: "8.5 Redução Temporária de Volume (deloading)",
        objective: "Prevenir lesões e overtraining quando os biomarcadores ou o histórico sugerem acúmulo severo de fadiga acumulada no microciclo.",
        duration: "1 a 2 semanas dependendo da resposta adaptativa",
        usage: "Quando o índice de Prontidão (Readiness) cai consistentemente abaixo de 40.",
        principles: "Reduzir volume semanal de quilômetros em 30% a 50%, mantendo uma intensidade mínima controlada."
      },
      {
        name: "8.6 Semana de Descarga (Recuperação Programada)",
        objective: "Permitir a restauração de tecidos conjuntivos e tendões após blocos de 3 a 4 semanas de carga crescente.",
        duration: "7 dias (tipicamente a última semana do ciclo de 4 semanas)",
        usage: "Planejada de forma programada dentro da periodização cíclica.",
        principles: "Reduzir volume geral em torno de 40%, suavizar os treinos de tiro e focar em recuperação e técnica."
      },
      {
        name: "8.7 Retorno Gradual após Pausa",
        objective: "Evitar lesões musculoesqueléticas ao reintroduzir corrida após períodos de afastamento por lesão, férias ou doença.",
        duration: "1 a 3 semanas progressivas",
        usage: "Sempre após mais de 10 a 14 dias de interrupção completa.",
        principles: "Iniciar com treinos intercalando corrida leve e caminhada (ex: 2 min corre / 1 min caminha) e progredir distância lentamente."
      }
    ]
  },
  {
    id: "avaliacao_testes",
    title: "9. Avaliação e Testes Fisiológicos",
    description: "Métodos científicos e práticos para o treinador mensurar limiares, reavaliar zonas cardíacas de treino, estimar o VO2 máximo e mapear o progresso longitudinal do atleta.",
    items: [
      {
        name: "9.1 Teste de 1 Milha (Teste de Rockport)",
        objective: "Avaliar o VO2 máximo de forma indireta e segura para iniciantes ou indivíduos que estão retornando após longo período parado.",
        execution: "Caminhar de forma mais rápida e constante possível por exatamente 1.609 metros (1 milha) em pista plana ou esteira. Registrar o tempo exato e a frequência cardíaca imediatamente ao terminar.",
        metrics: "Calculado a partir de fórmulas que usam idade, peso, tempo e FC final."
      },
      {
        name: "9.2 Teste de 3 km",
        objective: "Estimar o ritmo de Limiar Anaeróbico e ritmo de VO2 máximo de forma prática para corredores intermediários em menor custo de recuperação.",
        execution: "Realizar aquecimento de 10 min leve. Correr exatamente 3.000 metros em pista plana ou percurso sem trânsito no ritmo máximo e constante que conseguir sustentar.",
        metrics: "O pace médio obtido serve como base para calcular as zonas de pace e FC estimadas."
      },
      {
        name: "9.3 Teste de 5 km",
        objective: "Avaliar a velocidade aeróbica máxima (VAM), ritmo de limiar e resistência muscular específica de alta intensidade.",
        execution: "Aquecer 12 min leves + educativos. Executar 5.000m contra o relógio no menor tempo possível de forma uniforme.",
        metrics: "Serve como referência de ritmo máximo de 5k para calcular ritmos de treinos intervalados."
      },
      {
        name: "9.4 Teste de Tempo em Distância Conhecida (Time Trial)",
        objective: "Simular o estresse competitivo de forma isolada para calibrar a tática e autoconfiança antes do evento principal.",
        execution: "Corrida cronometrada em uma distância específica de teste em ritmo firme de prova planejado.",
        metrics: "Análise de desvio cardíaco e capacidade de aceleração no terço final."
      },
      {
        name: "9.5 Monitoramento de Pace & Frequência Cardíaca",
        objective: "Acompanhar a eficiência cardiovascular longitudinal (mesmo pace gerando menor frequência cardíaca indica ganho de condicionamento).",
        execution: "Cruzar os dados de pace e FC em treinos repetitivos de Zona 2 realizados sob as mesmas condições ambientais.",
        metrics: "Razão de Eficiência Aeróbica (Pace em min/km dividido pela FC média)."
      },
      {
        name: "9.6 Percepção Subjetiva de Esforço (RPE / Borg)",
        objective: "Ensinar o atleta a calibrar a intensidade com base na sensação corporal interna, essencial para correr em locais sem sinal de GPS.",
        execution: "Ao final de cada treino, o atleta atribui uma nota de 1 a 10 ao esforço geral percebido.",
        metrics: "Uso da Escala de Borg Adaptada (1-10) para monitoramento de carga agudo/crônico."
      },
      {
        name: "9.7 Acompanhamento da Distância Máxima Tolerada",
        objective: "Determinar o limite seguro de fadiga musculoesquelética crônica antes da ocorrência de dor ou biomecânica defeituosa.",
        execution: "Logar a distância semanal acumulada e monitorar a ocorrência de pequenos desconfortos residuais.",
        metrics: "Se dores nas articulações ocorrem após determinado volume, define-se o teto adaptativo temporário do atleta."
      }
    ]
  },
  {
    id: "guia_prescricao",
    title: "10. Anatomia de uma Prescrição Perfeita",
    description: "Manual de diretrizes metodológicas que todo treinador de corrida de excelência deve dominar ao prescrever treinos.",
    items: [
      {
        name: "Manual do Treinador de Corrida",
        details: "Nenhum treino deve ser apenas 'corra 5km'. Uma prescrição profissional ideal deve conter as seguintes informações:",
        points: [
          "1. Objetivo do treino (por que o atleta está fazendo isso)",
          "2. Aquecimento estruturado (ativação metabólica e articular)",
          "3. Exercícios educativos biomecânicos aplicáveis (educativos de técnica)",
          "4. Distância ou duração exata das sessões",
          "5. Intensidade detalhada (Zona cardíaca, Pace alvo ou RPE)",
          "6. Pace-alvo estimado quando apropriado",
          "7. Ritmo de esforço subjetivo esperado (RPE)",
          "8. Faixa de Frequência Cardíaca útil",
          "9. Tempo de intervalo de recuperação preciso",
          "10. Tipo de recuperação (passiva/parado, caminhada, trote leve)",
          "11. Desaquecimento (volta à calma físico-emocional)",
          "12. Alternativa adaptativa para nível inferior (regressão caso esteja cansado ou iniciante)",
          "13. Progressão de volume/intensidade para nível superior",
          "14. Quando reduzir a intensidade de forma preventiva durante o treino",
          "15. Quando interromper imediatamente a atividade (critérios de segurança: dor articular aguda, tontura, dor precordial, etc.)"
        ],
        fallbacks: {
          title: "Diretrizes de Substituição / Fallbacks Rápidos:",
          situations: [
            { cond: "Falta de equipamento (academia fechada)", sol: "Substituir treinos de força por peso corporal funcional (agachamentos livres, passadas, pontes de glúteo e pranchas)." },
            { cond: "Dor articular ou lesão inicial", sol: "Substituir corrida por caminhada ativa ou descanso completo. Consultar fisioterapeuta." },
            { cond: "Baixa experiência (iniciante)", sol: "Substituir metas rígidas de pace ou zonas de FC por tempo e esforço puramente subjetivo (RPE 3-4)." },
            { cond: "Fadiga crônica ou baixa prontidão", sol: "Substituir treinos de tiro/intervalados por rodagem regenerativa leve de 30 minutos ou alongamento/mobilidade ativa." },
            { cond: "Falta de tempo", sol: "Encurtar a rodagem ou reduzir o número de séries do treino de força, preservando apenas os exercícios de base (agachamento livre, prancha)." },
            { cond: "Limitação de espaço (viagem, hotel)", sol: "Realizar treinos técnicos de skipping em espaço curto e rotina de core ou força com peso corporal no quarto." }
          ]
        }
      }
    ]
  }
];
