// Review-only adapter. No credentials, network, authentication or persistence.
export const configured=false,client=null;
const blocked=async()=>{throw Error('Ini pratinjau tampilan. Tidak ada data yang disimpan atau diterbitkan.');};
export const verifiedUser=async()=>null,workspace=blocked,bootstrap=blocked,revision=blocked,command=blocked,recordCommand=blocked,accountCommand=blocked,rpc=blocked;
export const errorText=e=>e.message;
export const appBase=new URL('../../app/',import.meta.url);
