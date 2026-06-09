// src/test-check3.ts
abstract class Base<TState, TEvent extends { type: string }> {
  protected state: TState;
  protected constructor(state: TState) { this.state = state; }
  protected abstract when(state: TState, event: TEvent): TState;
}

type MyState = { v: number };
type MyEvent = { type: 'Inc'; data: { amount: number } };

export class Child extends Base<MyState, MyEvent> {
  constructor(state: MyState) { super(state); }
  protected when(state: MyState, event: MyEvent): MyState {
    return { v: state.v + event.data.amount };
  }
}
