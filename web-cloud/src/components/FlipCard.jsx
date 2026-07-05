import "./FlipCard.css"
import { useNavigate } from "react-router-dom";


// function onClick(){
//     alert("Pressed")
// }




function FlipCard({frontImgPath,backImgPath,text,path}){
  const navigate = useNavigate();

  const handleImageClick = () => {
    navigate(path);
  };
    return (
      <button className="flip-card" onClick={handleImageClick}>
        <div className="flip-card-inner">
          <div className="flip-card-front">
            <p className="title">{text}</p>
            <img className="quad-frontimg" src={frontImgPath} alt="Front Img" />
          </div>
          <div className="flip-card-back">
            <p className="title">{text}</p>
            <img className="quad-backimg" src={backImgPath} alt="Back Img" />
          </div>
        </div>
      </button>
    );
  }


export default  FlipCard