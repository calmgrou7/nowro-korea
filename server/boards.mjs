import { randomUUID } from 'node:crypto';
import { ServiceError } from './store.mjs';
export const boardIds = ['guide','busan','partners'];
export function boardPosts(store, admin=false) {
 const rows=JSON.parse(store.db.prepare("SELECT value FROM config WHERE key='board_posts'").get()?.value || '[]');
 return admin ? rows : rows.filter(p=>p.published);
}
export function saveBoardPost(store, session, input) {
 if(session.role!=='admin') throw new ServiceError('FORBIDDEN',403);
 if(!boardIds.includes(input.board) || typeof input.title!=='string' || !input.title.trim() || input.title.length>150 || typeof input.body!=='string' || !input.body.trim() || input.body.length>12000 || typeof input.published!=='boolean') throw new ServiceError('INVALID_POST',400);
 const image=typeof input.image==='string'?input.image.trim():'';
 if(image && (!image.startsWith('https://') || image.length>2000)) throw new ServiceError('INVALID_IMAGE',400);
 const rows=boardPosts(store,true); const previous=rows.find(p=>p.id===input.id);
 if(input.id && !previous) throw new ServiceError('NOT_FOUND',404);
 if(!previous && rows.length>=100) throw new ServiceError('POST_LIMIT',400);
 const post={id:previous?.id||randomUUID(),board:input.board,title:input.title.trim(),body:input.body.trim(),image,published:input.published,updated:new Date().toISOString()};
 store.db.prepare('INSERT OR REPLACE INTO config(key,value) VALUES(?,?)').run('board_posts',JSON.stringify([post,...rows.filter(p=>p.id!==post.id)]));
 store.audit(session.user_id,'board_post_saved',{id:post.id,board:post.board,published:post.published});
 return post;
}
