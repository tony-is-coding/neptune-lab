export type MessageSource = 'user' | 'teammate' | 'system' | 'tick' | 'task';
export type Message = {
    id: string;
    source: MessageSource;
    content: string;
    from?: string;
    color?: string;
    timestamp: string;
};
export declare class Mailbox {
    private queue;
    private waiters;
    private changed;
    private _revision;
    get length(): number;
    get revision(): number;
    send(msg: Message): void;
    poll(fn?: (msg: Message) => boolean): Message | undefined;
    receive(fn?: (msg: Message) => boolean): Promise<Message>;
    subscribe: (listener: () => void) => () => void;
    private notify;
}
//# sourceMappingURL=mailbox.d.ts.map