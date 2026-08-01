export class DataError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DataError";
    this.status = status;
  }
}
