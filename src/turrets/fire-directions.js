// Native ship axes match the standard viewport views (+Y top, +Z front).
export const FIRE_DIRECTIONS={top:[1,1],bottom:[1,-1],left:[0,-1],right:[0,1],front:[2,1],back:[2,-1]};
export function inFireDirection(vector,direction){
 const sector=FIRE_DIRECTIONS[direction];if(!sector)return true;
 const [axis,sign]=sector,value=vector[axis]*sign;
 return value>=Math.max(...vector.map(Math.abs))-1e-8;
}
