// Runs `fn` inside a Postgres SERIALIZABLE transaction, retrying once on a
// serialization failure (Prisma P2034). Used anywhere a read-then-write
// invariant must hold under concurrency without an explicit row lock -
// e.g. two recruiters racing to consume the last job-posting credit, or
// two webhook deliveries racing to activate the same purchase (section
// 10/11: "Concurrency must prevent two recruiters from consuming the last
// credit simultaneously").
export async function runSerializableTransaction(prisma, fn, { retries = 2 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (error) {
      const isSerializationFailure = error?.code === 'P2034';
      if (isSerializationFailure && attempt < retries) {
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}
