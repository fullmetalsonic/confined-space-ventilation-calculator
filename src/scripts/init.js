function initGuidanceAccordion(){
  const grid = document.querySelector('.guidance-grid');
  if(!grid) return;

  const groups = Array.from(grid.querySelectorAll('details.guidance-group'));
  groups.forEach(group=>{
    group.addEventListener('toggle', ()=>{
      if(group.open){
        groups.forEach(other=>{
          if(other !== group) other.open = false;
        });
      }
      grid.classList.toggle('has-open', groups.some(item=>item.open));
    });
  });
}
