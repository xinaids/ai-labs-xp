from collections import deque
import heapq
import time

# ─────────────────────────────────────────────
# Estado final desejado (objetivo da busca)
# O espaço vazio (0) deve estar na última posição
# Disciplina de Inteligência Artificial - IFRS Campus Ibirubá!!!
# ─────────────────────────────────────────────

ESTADO_FINAL = (1, 2, 3, 4, 5, 6, 7, 8, 0)

# Posição-alvo de cada peça no estado final (para heurística)
# Ex: peça 1 deve estar na posição 0, peça 2 na posição 1, etc.
POSICAO_ALVO = {val: idx for idx, val in enumerate(ESTADO_FINAL)}

# ─────────────────────────────────────────────
# Funções auxiliares compartilhadas
# ─────────────────────────────────────────────

def is_solvable(estado):
    """
    Verifica se o estado inicial é solúvel contando inversões.
    Uma inversão ocorre quando uma peça de valor maior aparece antes
    de uma peça de valor menor na sequência linear do tabuleiro.
    Se o número de inversões for ímpar, o estado é insolúvel.
    """
    nums = [x for x in estado if x != 0]
    inversoes = sum(
        1 for i in range(len(nums))
        for j in range(i + 1, len(nums))
        if nums[i] > nums[j]
    )
    return inversoes % 2 == 0

def encontrar_zero(estado):
    """Retorna o índice do espaço vazio (0) no estado."""
    return estado.index(0)

def gerar_movimentos(estado):
    """
    Gera todos os estados possíveis a partir do estado atual.
    Para cada direção válida, troca o espaço vazio (0)
    com a peça vizinha, gerando um novo estado sucessor.
    """
    movimentos = []
    idx_zero = encontrar_zero(estado)
    linha, col = divmod(idx_zero, 3)

    direcoes = {
        'cima':     (-1,  0),
        'baixo':    ( 1,  0),
        'esquerda': ( 0, -1),
        'direita':  ( 0,  1),
    }

    for nome, (dl, dc) in direcoes.items():
        nova_linha, nova_col = linha + dl, col + dc
        if 0 <= nova_linha < 3 and 0 <= nova_col < 3:
            novo_idx = nova_linha * 3 + nova_col
            novo_estado = list(estado)
            novo_estado[idx_zero], novo_estado[novo_idx] = \
                novo_estado[novo_idx], novo_estado[idx_zero]
            movimentos.append((tuple(novo_estado), nome))

    return movimentos

def imprimir_grade(estado, titulo=""):
    """Imprime o estado do puzzle em formato de grade 3x3."""
    if titulo:
        print(f"\n{titulo}")
    print("┌───┬───┬───┐")
    for i in range(0, 9, 3):
        linha = "│"
        for j in range(3):
            val = estado[i + j]
            linha += f" {'_' if val == 0 else val} │"
        print(linha)
        if i < 6:
            print("├───┼───┼───┤")
    print("└───┴───┴───┘")

# ─────────────────────────────────────────────
# BFS — Busca em Largura (implementação original)
# ─────────────────────────────────────────────

def bfs(estado_inicial):
    """
    Busca em Largura (BFS) para resolver o 8 Puzzle.
    Explora o espaço de estados nível por nível, garantindo
    que a primeira solução encontrada seja a ótima.
    Retorna: (caminho, total_estados_testados)
    """
    if estado_inicial == ESTADO_FINAL:
        return [], 0

    fila = deque()
    fila.append((estado_inicial, []))
    visitados = {estado_inicial}
    total_testados = 0

    while fila:
        estado_atual, caminho = fila.popleft()
        total_testados += 1

        for novo_estado, movimento in gerar_movimentos(estado_atual):
            if novo_estado not in visitados:
                novo_caminho = caminho + [(movimento, novo_estado)]
                if novo_estado == ESTADO_FINAL:
                    return novo_caminho, total_testados + 1
                visitados.add(novo_estado)
                fila.append((novo_estado, novo_caminho))

    return None, total_testados

# ─────────────────────────────────────────────
# A* — Busca Heurística com Distância Manhattan
# ─────────────────────────────────────────────

def manhattan(estado):
    """
    Heurística da Distância Manhattan para o 8 Puzzle.

    Para cada peça (exceto o espaço vazio), calcula a soma das
    distâncias horizontais e verticais até a sua posição-alvo.
    Essa função é ADMISSÍVEL (nunca superestima o custo real)
    e CONSISTENTE (satisfaz a desigualdade triangular), o que
    garante que o A* encontre sempre a solução ótima.

    Exemplo: peça 5 na posição (0,2) com alvo em (1,1)
             → distância = |0-1| + |2-1| = 1 + 1 = 2
    """
    distancia = 0
    for idx, val in enumerate(estado):
        if val != 0:
            linha_atual, col_atual = divmod(idx, 3)
            linha_alvo,  col_alvo  = divmod(POSICAO_ALVO[val], 3)
            distancia += abs(linha_atual - linha_alvo) + abs(col_atual - col_alvo)
    return distancia

def astar(estado_inicial):
    """
    Busca A* para resolver o 8 Puzzle usando a heurística Manhattan.

    A* seleciona sempre o nó com menor f(n) = g(n) + h(n), onde:
      g(n) = custo real do caminho do início até n (número de movimentos)
      h(n) = heurística Manhattan (estimativa do custo restante até o objetivo)

    Por ser admissível e consistente, h(n) garante solução ótima.
    O uso da fila de prioridade (heap) viabiliza a seleção eficiente
    do nó mais promissor, explorando muito menos estados que o BFS.

    Retorna: (caminho, total_estados_testados)
    """
    if estado_inicial == ESTADO_FINAL:
        return [], 0

    h_inicial = manhattan(estado_inicial)
    heap = [(h_inicial, 0, estado_inicial, [])]
    visitados = {}
    total_testados = 0

    while heap:
        f, g, estado_atual, caminho = heapq.heappop(heap)

        if estado_atual in visitados and visitados[estado_atual] <= g:
            continue
        visitados[estado_atual] = g
        total_testados += 1

        for novo_estado, movimento in gerar_movimentos(estado_atual):
            novo_g = g + 1
            if novo_estado not in visitados or visitados[novo_estado] > novo_g:
                novo_caminho = caminho + [(movimento, novo_estado)]
                if novo_estado == ESTADO_FINAL:
                    return novo_caminho, total_testados + 1
                novo_h = manhattan(novo_estado)
                novo_f = novo_g + novo_h
                heapq.heappush(heap, (novo_f, novo_g, novo_estado, novo_caminho))

    return None, total_testados

# ─────────────────────────────────────────────
# Exibição de resultados
# ─────────────────────────────────────────────

def exibir_resultado(caminho, total_testados, tempo, estado_inicial, algoritmo):
    """Exibe estatísticas e sequência de movimentos da solução."""
    print(f"\n✅ Solução encontrada ({algoritmo})!")
    print(f"   Movimentos necessários : {len(caminho)}")
    print(f"   Estados testados       : {total_testados}")
    print(f"   Tempo de execução      : {tempo:.4f}s")

    print("\n" + "=" * 42)
    print(f"  SEQUÊNCIA DE MOVIMENTOS — {algoritmo}")
    print("=" * 42)
    imprimir_grade(estado_inicial, "Passo 0 - Estado Inicial:")
    for i, (movimento, estado) in enumerate(caminho, 1):
        imprimir_grade(estado, f"Passo {i} - Movimento: {movimento.upper()}")

    print("\n" + "=" * 42)
    print(f"Sequência: {' → '.join(m.upper() for m, _ in caminho)}")
    print("=" * 42)

# ─────────────────────────────────────────────
# Resolver com comparação BFS vs A*
# ─────────────────────────────────────────────

def resolver(entrada):
    """Função principal: resolve o puzzle com BFS e A* e compara."""
    try:
        clean = entrada.strip()
        if len(clean) == 9 and clean.isdigit():
            numeros = [int(c) for c in clean]
        else:
            numeros = list(map(int, clean.split()))

        if len(numeros) != 9 or sorted(numeros) != list(range(9)):
            raise ValueError("Entrada inválida.")

        estado_inicial = tuple(numeros)

    except Exception as e:
        print(f"Erro na entrada: {e}")
        return

    print("\n" + "=" * 42)
    print("  RESOLVEDOR DE 8 PUZZLE — BFS e A*")
    print("=" * 42)
    imprimir_grade(estado_inicial, "Estado Inicial:")
    imprimir_grade(ESTADO_FINAL,   "Estado Final:")

    if not is_solvable(estado_inicial):
        print("\n❌ Sem solução para este estado inicial.")
        print("   (número ímpar de inversões — estado insolúvel)")
        return

    # ── BFS ────────────────────────────────────────────────
    print("\n[BFS] Buscando solução...")
    t0 = time.time()
    caminho_bfs, testados_bfs = bfs(estado_inicial)
    tempo_bfs = time.time() - t0

    # ── A* ─────────────────────────────────────────────────
    print("[A* ] Buscando solução...")
    t0 = time.time()
    caminho_astar, testados_astar = astar(estado_inicial)
    tempo_astar = time.time() - t0

    # ── Comparativo ────────────────────────────────────────
    print("\n" + "=" * 42)
    print("  COMPARATIVO: BFS vs A* (Manhattan)")
    print("=" * 42)
    print(f"{'Métrica':<28} {'BFS':>6}  {'A*':>6}")
    print("-" * 42)
    print(f"{'Movimentos na solução':<28} {len(caminho_bfs):>6}  {len(caminho_astar):>6}")
    print(f"{'Estados testados':<28} {testados_bfs:>6}  {testados_astar:>6}")
    print(f"{'Tempo (s)':<28} {tempo_bfs:>6.4f}  {tempo_astar:>6.4f}")
    reducao = (1 - testados_astar / testados_bfs) * 100 if testados_bfs > 0 else 0
    print(f"\n  A* reduziu estados testados em {reducao:.1f}%")
    print("=" * 42)

    # ── Escolha do algoritmo para exibir passos ────────────
    print("\nQual solução detalhar?")
    print("  1 - BFS")
    print("  2 - A*")
    print("  3 - Ambos")
    print("  0 - Nenhum (só o comparativo)")
    escolha = input("Opção: ").strip()

    if escolha in ("1", "3"):
        exibir_resultado(caminho_bfs,   testados_bfs,   tempo_bfs,   estado_inicial, "BFS")
    if escolha in ("2", "3"):
        exibir_resultado(caminho_astar, testados_astar, tempo_astar, estado_inicial, "A*")

# ─────────────────────────────────────────────
# Ponto de entrada
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("8 PUZZLE — BFS e A* (Distância Manhattan)")
    print("Informe o estado inicial:")
    print("  Formato colado  : 123456708")
    print("  Formato espaços : 1 2 3 4 5 6 7 0 8")
    print()
    entrada = input("Estado inicial: ")
    resolver(entrada)