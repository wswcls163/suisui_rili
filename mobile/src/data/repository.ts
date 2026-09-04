import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { SqliteBirthdayRepository } from './sqlite';

export const repository = new SqliteBirthdayRepository(() => openDatabaseAsync('suisui.db'), randomUUID);
export const storageDescription = '生日保存在这台设备上，关闭应用后仍会保留。';
