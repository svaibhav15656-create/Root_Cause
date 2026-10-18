const form=document.querySelector('#reset-form');
const feedback=document.querySelector('#reset-feedback');
const submit=form.querySelector('button[type="submit"]');
const token=new URLSearchParams(location.search).get('token')||'';
if(!/^[A-Za-z0-9_-]{40,50}$/.test(token)){
  feedback.textContent='This reset link is invalid or expired. Request a new one.';
  form.querySelectorAll('input,button').forEach(control=>control.disabled=true);
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(form));
  if(values.password!==values.confirm){feedback.textContent='The passwords do not match.';feedback.classList.add('error');return}
  submit.disabled=true;feedback.textContent='';feedback.classList.remove('error');
  try{
    const response=await fetch('/api/password/reset',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({token,password:values.password})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not reset the password.');
    feedback.textContent=result.message;form.querySelectorAll('input,button').forEach(control=>control.disabled=true);document.querySelector('#login-link').classList.remove('hidden');
  }catch(error){feedback.textContent=error.message;feedback.classList.add('error');submit.disabled=false}
});
