/**
 * 범용 오브젝트 풀. create() 로 생성하고 acquire()/release() 로 재사용한다.
 */
export class ObjectPool {
  constructor(create, reset = null, initial = 0) {
    this._create = create;
    this._reset = reset;
    this.free = [];
    this.active = [];
    for (let i = 0; i < initial; i++) this.free.push(create());
  }

  acquire() {
    const obj = this.free.length ? this.free.pop() : this._create();
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const i = this.active.indexOf(obj);
    if (i !== -1) {
      this.active[i] = this.active[this.active.length - 1];
      this.active.pop();
    }
    this._reset?.(obj);
    this.free.push(obj);
  }

  /** 활성 오브젝트를 순회하며 fn 이 false 를 반환하면 해제한다. */
  updateActive(fn) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const obj = this.active[i];
      if (fn(obj) === false) {
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        this._reset?.(obj);
        this.free.push(obj);
      }
    }
  }

  releaseAll() {
    while (this.active.length) {
      const obj = this.active.pop();
      this._reset?.(obj);
      this.free.push(obj);
    }
  }
}
