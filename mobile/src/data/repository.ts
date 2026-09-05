import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { SqliteBirthdayRepository } from './sqlite';

export const repository = new SqliteBirthdayRepository(() => openDatabaseAsync('suisui.db'), randomUUID);
export const storageDescription = '生日先保存在这台设备上，登录后可同步到其他设备。';
