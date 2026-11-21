CONSTANTES
    VELOCIDADE_MAX ← 500          // metros/min (moto a 30 km/h)

DADOS
    locais       ← 16 pontos (cozinhas, academias, campus, praça...)
    coordenadas  ← posição (x, y) em metros de cada local
    ruas         ← lista de (A, B, distância, trânsito), mão dupla
                   trânsito: 1.0 = livre, 0.4 = congestionado


FUNÇÃO custo(distância, trânsito)
    // tempo gasto em uma rua
    RETORNAR distância / (VELOCIDADE_MAX × trânsito)


FUNÇÃO estimativa(local, destino)
    // tempo em linha reta na velocidade máxima
    // nunca passa do tempo real → A* acha a rota ótima
    RETORNAR distância_reta(local, destino) / VELOCIDADE_MAX


FUNÇÃO a_estrela(grafo, origem, destino)
    fila ← [ origem ]      // ordenada pelo menor f = g + h
    visitados ← vazio

    ENQUANTO fila não está vazia
        atual ← remove da fila o nó com menor f

        SE atual já foi visitado
            PULAR
        marca atual como visitado

        SE atual = destino
            RETORNAR tempo gasto, caminho, nº de nós visitados

        PARA CADA vizinho de atual
            SE vizinho não foi visitado
                g ← tempo até atual + custo(rua, trânsito)
                h ← estimativa(vizinho, destino)
                f ← g + h
                coloca vizinho na fila com prioridade f

    RETORNAR "sem caminho"


PROGRAMA PRINCIPAL
    // 1. Montar o mapa
    PARA CADA rua em ruas
        VALIDAR: distância da rua ≥ distância em linha reta
        liga A → B e B → A no grafo

    // 2. Entrada
    MOSTRAR lista de locais
    LER entregador, cozinha, entrega
    SE algum número não existe → ERRO e encerrar

    // 3. Calcular os dois trechos
    trecho1 ← a_estrela(entregador → cozinha)    // retirada
    trecho2 ← a_estrela(cozinha → entrega)       // entrega

    // 4. Resultado
    SE os dois trechos têm caminho
        MOSTRAR caminho e tempo do trecho 1
        MOSTRAR caminho e tempo do trecho 2
        MOSTRAR tempo total = tempo1 + tempo2
        MOSTRAR nós visitados vs. total possível
    SENÃO
        MOSTRAR "Não existe caminho"