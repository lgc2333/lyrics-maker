export interface Command<TState> {
  label: string
  do: (state: TState) => TState
  undo: (state: TState) => TState
}
