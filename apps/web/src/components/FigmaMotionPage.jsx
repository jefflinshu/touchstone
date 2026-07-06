import figmaIcon from '@lobehub/icons-static-svg/icons/figma-color.svg'
import Fable5Page from './Fable5Page.jsx'

export default function FigmaMotionPage({ onBack }) {
  return (
    <Fable5Page
      onBack={onBack}
      dataBase="/figma-motion-data"
      dataLabel="figma-motion"
      title="FIGMA MOTION"
      iconSrc={figmaIcon}
      analyticsPrefix="figma_motion"
      enableFavorites={false}
      visualMode
    />
  )
}
