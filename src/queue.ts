class Queue<T = any> {
    private items: T[] = [];

    push(item: T): void {
        this.items.push(item);
    }

    pop(): T | undefined {
        return this.items.shift() as T;
    }

    peek(): T | undefined {
        return this.items[0];
    }

    length(): number {
        return this.items.length;
    }
}

export default Queue;