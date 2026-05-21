export type ConnectorTextBlock = {
    type: string;
    connector_text: string;
    signature?: string;
    [key: string]: unknown;
};
export type ConnectorTextDelta = {
    type: string;
    connector_text: string;
    text?: string;
    thinking?: string;
    signature?: string;
    [key: string]: unknown;
};
export declare const isConnectorTextBlock: (block: unknown) => block is ConnectorTextBlock;
//# sourceMappingURL=connectorText.d.ts.map