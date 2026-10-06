// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const members=sqliteTable('members',{email:text('email').primaryKey(),name:text('name').notNull(),role:text('role').notNull(),active:integer('active').notNull().default(1)});
export const products=sqliteTable('products',{code:text('code').primaryKey(),plu:text('plu').notNull(),name:text('name').notNull(),price:integer('price').notNull(),mode:text('mode').notNull().default('weight')});
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const sales=sqliteTable('sales',{id:text('id').primaryKey(),created:text('created').notNull(),cashier:text('cashier').notNull(),total:integer('total').notNull(),cash:integer('cash').notNull(),qr:integer('qr').notNull(),items:text('items').notNull(),status:text('status').notNull().default('completed'),voidReason:text('void_reason'),qrRecipient:text('qr_recipient')});
