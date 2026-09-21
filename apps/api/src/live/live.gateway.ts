import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class LiveGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    client.emit('hello', { ok: true });
  }

  broadcastWin(payload: { username: string; gameSlug: string; amount: number }) {
    this.server?.emit('live:win', { ...payload, at: new Date().toISOString() });
  }

  broadcastFeed(payload: any) {
    this.server?.emit('live:feed', payload);
  }

  broadcastCrash(payload: { roundId: string; crashPoint: number }) {
    this.server?.emit('crash:crashed', payload);
  }
}
