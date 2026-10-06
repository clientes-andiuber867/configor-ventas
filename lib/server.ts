import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import type {Member} from './domain';
export function db(){if(!env.DB)throw Error('Base de datos no disponible.');return env.DB}
export function bucket(){if(!env.BUCKET)throw Error('Almacenamiento no disponible.');return env.BUCKET}
export async function authorize(admin=false){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Inicia sesión para continuar.');const email=user.email.toLowerCase();
 await db().prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('owner',?)").bind(email).run();
 const owner=await db().prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();
 if(owner?.value===email)await db().prepare("INSERT OR IGNORE INTO members(email,name,role,active) VALUES (?,?,'admin',1)").bind(email,user.displayName).run();
 const m=await db().prepare('SELECT * FROM members WHERE email=?').bind(email).first<Member>();if(!m||!m.active)throw new HttpError(403,'Tu usuario no tiene acceso. Solicita al administrador que habilite tu correo.');if(admin&&m.role!=='admin')throw new HttpError(403,'Esta acción requiere un administrador.');return m;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export async function config(key:string,fallback:any){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();return row?JSON.parse(row.value):fallback}
export function setting(key:string,value:any){return db().prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value))}
