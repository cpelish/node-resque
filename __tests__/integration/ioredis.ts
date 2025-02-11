import { Queue, Worker, Scheduler, Job } from "../../src";
import specHelper from "../utils/specHelper";

const connectionDetails = {
  pkg: "ioredis",
  host: "127.0.0.1",
  port: 6379,
  database: parseInt(process.env.JEST_WORKER_ID || "0"),
};

const jobs = {
  add: {
    perform: async (a, b) => {
      const response = a + b;
      return response;
    },
  } as Job<any>,
};

describe("testing with ioredis package", () => {
  let queue: Queue;
  let scheduler: Scheduler;
  let worker: Worker;

  afterAll(async () => {
    await queue.end();
    await scheduler.end();
    await worker.end();
  });

  test("a queue can be created", async () => {
    queue = new Queue({ connection: connectionDetails }, jobs);
    await queue.connect();
  });

  test("a scheduler can be created", async () => {
    scheduler = new Scheduler({ connection: connectionDetails }, jobs);
    await scheduler.connect();
    // await scheduler.start();
  });

  test("a worker can be created", async () => {
    worker = new Worker(
      {
        connection: connectionDetails,
        queues: ["math"],
        timeout: specHelper.timeout,
      },
      jobs
    );
    await worker.connect();
    // worker.start();
  });

  test("a job can be enqueued", async () => {
    await queue.enqueueIn(1, "math", "add", [1, 2]);
    const times = await queue.scheduledAt("math", "add", [1, 2]);
    expect(times.length).toBe(1);
  });

  test("the scheduler can promote the job", async () => {
    await scheduler.poll();
    const times = await queue.scheduledAt("math", "add", [1, 2]);
    expect(times.length).toBe(0);
    const jobsLength = await queue.length("math");
    expect(jobsLength).toBe(1);
  });

  test("the worker can work the job", async () => {
    await new Promise(async (resolve) => {
      await worker.start();
      worker.on("success", async (q, job, result, duration) => {
        expect(q).toBe("math");
        expect(job.class).toBe("add");
        expect(result).toBe(3);
        expect(worker.result).toBe(result);
        expect(duration).toBeGreaterThanOrEqual(0);

        worker.removeAllListeners("success");
        resolve(null);
      });
    });
  });
});
