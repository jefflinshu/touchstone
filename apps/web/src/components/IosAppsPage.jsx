import appleIcon from '@lobehub/icons-static-svg/icons/apple.svg'
import Fable5Page from './Fable5Page.jsx'

export default function IosAppsPage({ onBack }) {
  return (
    <Fable5Page
      onBack={onBack}
      dataBase="/ios-apps-data"
      dataLabel="ios-apps"
      title="iOS APPS"
      iconSrc={appleIcon}
      analyticsPrefix="ios_apps"
      enableFavorites={false}
    />
  )
}
