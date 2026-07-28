# Arquitetura do Sistema Aetheris Motor Fisiológico & Prescritivo de Treinamento

> **Princípio Fundamental:** O objetivo do algoritmo não é descobrir se o atleta pode treinar, mas sim determinar qual é o maior estímulo que ele consegue absorver hoje sem comprometer a adaptação futura.

---

## 1. Visão Geral da Arquitetura

O **Aetheris** é um motor fisiológico de decisão e recomendação de treino baseado em evidências e dados biométricos. A arquitetura segue uma separação estrita de responsabilidades em três camadas fundamentais:

```
                  ┌─────────────────────────────────────────┐
                  │          ENTRADA DE DADOS E BIOMARCADORES│
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                            MOTOR AETHERIS                                 │
 │                                                                           │
 │  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────┐ │
 │  │ 1. MODELO DE CARGA     │  │ 2. RESPOSTA BIOLÓGICA │  │ 3. DECISÃO    │ │
 │  │    (ATL, CTL, ACWR,   │  │    (HRV, Sono, FC,    │  │    CONVERGENTE│ │
 │  │     TRIMP, EWMA)      │  │     Subjetivo, BB)    │  │    (Prescrição)│ │
 │  └───────────────────────┘  └───────────────────────┘  └───────────────┘ │
 └─────────────────────────────────────┬─────────────────────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │    PRESCRIÇÃO E INTERFAZE DO COACH     │
                  └─────────────────────────────────────────┘
```

---

## 2. Princípios de Design Fisiológico

### Princípio 1 — Separar Carga, Recuperação e Desempenho
O sistema trata de forma estritamente independente as três perguntas centrais do treinamento:
1. **Quanto o atleta treinou? (Carga Externa):** Medido via TRIMP, distância, intensidade, Monotonia e Deformação (*Strain*). Mede apenas o estresse aplicado.
2. **Como o organismo respondeu? (Carga Interna & Biomarcadores):** Medido via VFC/HRV relativa à linha de base individual de 21 dias, qualidade/quantidade de sono, variação da FC de repouso, Body Battery, percepção subjetiva e dor muscular.
3. **O que deve ser feito hoje? (Decisão Prescritiva):** Decisão emergente resultante da convergência entre a carga acumulada e a assimilação biológica.

### Princípio 2 — O Modelo Biológico dos Dois Tanques (Aptidão vs. Fadiga)
- **Tanque de Aptidão — CTL (*Chronic Training Load*):** Representa a aptidão crônica acumulada em uma janela móvel de 28 a 42 dias. Cresce lentamente e não flutua bruscamente em um único dia.
- **Tanque de Fadiga — ATL (*Acute Training Load*):** Representa a fadiga aguda gerada pelas sessões recentes (janela de 7 dias).
- **Modelo de Decaimento EWMA (*Exponentially Weighted Moving Average*):** A fadiga e a aptidão não utilizam cortes lineares ou porcentagens arbitrárias fixas. Utiliza-se cálculo EWMA com fator de suavização $\alpha = 0,20$:
  $$\text{ATL}_{\text{hoje}} = \text{ATL}_{\text{ontem}} + (\text{Carga}_{\text{hoje}} - \text{ATL}_{\text{ontem}}) \times \alpha$$
  Em dias de descanso, o decaimento exponencial natural é calculado por:
  $$\text{ATL}_{\text{descanso}} = \text{ATL}_{\text{bruta}} \times (1 - \alpha)^{\text{dias}}$$
- **Unidade de Medida:** A carga é expressa em unidades de **Training Load** (e não "pontos"), refletindo a natureza contínua do volume e intensidade acumulados.
- **Razão ACWR (*Acute-to-Chronic Workload Ratio*):**
  $$\text{ACWR} = \frac{\text{ATL}}{\text{CTL}}$$
  Funciona como um indicador de alerta sobre a velocidade de progressão da carga (Faixa Ótima: $0,80 \le \text{ACWR} \le 1,30$; Zona de Transição: $>1,30$; Pico Crítico: $>1,50$).

---

## 3. Calibração e Ponderação de Biomarcadores (Pontuação de Readiness)

O *Score Base de Readiness* ($0-100$) é composto por 6 pilares com pesos calibrados para mitigar redundâncias (ex: sobreposição entre Body Battery, VFC e Sono):

| Pilar / Biomarcador | Peso | Justificativa Fisiológica |
| :--- | :---: | :--- |
| **Quantidade de Sono** | **20%** | Reparação celular, síntese proteica e restauração neural. |
| **Qualidade de Sono / Score** | **20%** | Arquitetura do sono (fases profundas e REM). |
| **Sensação Subjetiva do Atleta** | **20%** | Percepção central; o sistema nervoso percebe a fadiga antes dos sensores. |
| **VFC / HRV (vs Baseline 21 dias)** | **15%** | Modulação autonômica parassimpática comparada ao histórico pessoal do atleta. |
| **Body Battery (Garmin)** | **15%** | Reserva energética geral (calibrado para evitar dupla contagem com VFC/Sono). |
| **Dor Muscular / Mecânica** | **10%** | Integridade do sistema musculoesquelético (estresse mecânico local). |

### Moduladores e Teto de Penalização Protegido
Apenas aplicar o score base poderia ignorar picos isolados de estresse. O motor aplica penalidades moduladoras (ex: elevação da FC de repouso, dias consecutivos sem treino, pico de ACWR).
- **Proteção por Teto de Penalidade:** O total de penalidades acumuladas possui um teto máximo rígido de **$-25\text{ pontos}$**. Isso evita a "espiral de penalização" quando múltiplos estressores ocorrem no mesmo dia.

---

## 4. Convergência de Evidências no Motor de Decisão

A tomada de decisão não depende de uma única variável "soberana". O motor avalia o alinhamento dos sinais:

```
                     ┌────────────────────────────────┐
                     │    CONVERGÊNCIA DE EVIDÊNCIAS  │
                     └───────────────┬────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
 🟢 VERDE (80-100)            🟡 AMARELO (55-79)             🔴 VERMELHO (<55)
 • Carga e recuperação        • Margem adaptativa reduzida  • Estresse elevado
   alinhadas                    • Mantém consistência,        • Foco em recuperação
 • Manter treino planejado      ajusta intensidade            • Rodagem Z2 leve,
                                (ex: Tiros ➔ Zona 2)          mobilidade ou descanso
```

---

## 5. Estrutura de Código e Módulos do Projeto

O projeto é construído em **React 18 + TypeScript + Vite + Tailwind CSS** no frontend, com um servidor **Node.js (Express)** no backend proxyando chamadas da **API Gemini** para diagnósticos do Coach AI.

```
/
├── server.ts                    # Entry point do servidor Express (API + Vite Middleware)
├── src/
│   ├── coach/
│   │   ├── coachEngine.ts       # Motor fisiológico puro (Readiness, EWMA, ACWR, Adjustments)
│   │   └── types.ts             # Tipagem do modelo biológico (DailyMetrics, Readiness, TrainingLoad)
│   ├── components/
│   │   ├── CoachWorkspace.tsx   # Dashboard principal do treinador e interface visual
│   │   ├── TelemetryCharts.tsx  # Gráficos de telemetria e evolução fisiológica
│   │   ├── AthleteProfileForm.tsx # Cadastro e parâmetros do atleta (VO2max, VAM, Limiares)
│   │   ├── GpsMap.tsx           # Visualização de rotas e telemetria de GPS
│   │   └── LanguageSelector.tsx # Seleção de idiomas (i18n)
│   ├── data/                    # Dados de treino e mock de demonstração
│   ├── i18n/                    # Dicionários de internacionalização (PT-BR, EN, ES)
│   └── App.tsx                  # Aplicação React principal
├── metadata.json                # Metadados do applet
└── package.json                 # Dependências e scripts de build
```

---

## 6. Fluxo de Execução do Algoritmo

1. **Entrada de Dados:** Inserção de métricas diárias do atleta (sono, VFC, FC repouso, percepção, dor, Body Battery).
2. **Cálculo da Carga Histórica:** Avaliação da distância semanal e mensal para calcular a carga crônica (CTL) e aguda (ATL com EWMA).
3. **Cálculo da Razão ACWR:** Determinação da relação $\text{ATL}/\text{CTL}$ em unidades de *Training Load*.
4. **Processamento do Score Base:** Avaliação dos 6 pilares biométricos ponderados.
5. **Aplicação do Teto de Moduladores:** Verificação de alertas de FC de repouso, destreino e picos de carga com teto de $-25\text{ pts}$.
6. **Motor Prescritivo de Treino (`adjustNextWorkout`):** Ajuste fino do treino planejado (redução de volume em Zona 2, conversão de tiros de alta intensidade em regenerativo, ou indicação de descanso ativo).
7. **Explicação ao Atleta / Treinador:** Geração da fundamentação em linguagem fisiológica humanizada.
