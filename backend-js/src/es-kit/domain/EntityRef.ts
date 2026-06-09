import {
  fromStreamName,
  toStreamName,
  type StreamName,
} from "@event-driven-io/emmett-mongodb";
import { randomUUID } from "node:crypto";

/**
 * Stream identity for Entity Kit entities.
 *
 * @description v1 uses plain UUID stream ids without prefix. Prefix API is present for future use.
 */
export class EntityRef<TStreamType extends string = string> {
  constructor(
    readonly streamType: TStreamType,
    readonly id: string,
    readonly prefix?: string,
  ) {}

  /**
   * Creates a new entity reference with a generated or explicit stream id.
   */
  static newId<T extends string>(streamType: T, id?: string): EntityRef<T> {
    return new EntityRef(streamType, id ?? randomUUID());
  }

  /**
   * Singleton stream pattern (e.g. settings `global`).
   */
  static singleton<T extends string>(streamType: T, id = "global"): EntityRef<T> {
    return new EntityRef(streamType, id);
  }

  toStreamName(): StreamName<TStreamType> {
    const streamId = this.prefix ? `${this.prefix}_${this.id}` : this.id;
    return toStreamName(this.streamType, streamId);
  }

  static fromStreamName<T extends string>(name: StreamName<T>): EntityRef<T> {
    const { streamType, streamId } = fromStreamName(name);
    const underscore = streamId.indexOf("_");

    if (underscore > 0) {
      return new EntityRef(
        streamType,
        streamId.slice(underscore + 1),
        streamId.slice(0, underscore),
      );
    }

    return new EntityRef(streamType, streamId);
  }
}
