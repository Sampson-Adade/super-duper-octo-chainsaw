import Home from '../page';

type JoinSearchParams = { room?: string | string[] };

export default async function JoinPage({ searchParams }: { searchParams: Promise<JoinSearchParams> }) {
  const params = await searchParams;
  const roomValue = Array.isArray(params.room) ? params.room[0] : params.room;
  const roomCode = String(roomValue || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);

  return <Home initialRoomCode={roomCode} lockRoomCode={Boolean(roomValue)} />;
}
