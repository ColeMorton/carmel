import React from 'react'
import { Component, Components, Screen } from 'react-dom-chunky'
import { Form, Icon, Row, Col, List, Collapse, Alert, Breadcrumb, Dropdown, Avatar, Menu, Tabs, Layout, notification } from 'antd'
import { Card, CardActions, CardActionButtons } from 'rmwc/Card'
import { Button, ButtonIcon } from 'rmwc/Button'
import { Fab } from 'rmwc/Fab'
import { Elevation } from 'rmwc/Elevation'
import fs from 'fs-extra'
import path from 'path'
import { Parallax } from 'react-spring'
import { Typography } from 'rmwc/Typography'
import { Data } from 'react-chunky'
import PopupMessage from '../components/popup'
import Shell from '../components/shell'
import Toolbar from '../components/toolbar'
import Challenge from '../components/challenge'
import Challenges from '../components/challenges'
import Browser from '../components/browser'
import Explorer from '../components/explorer'
import TabBar from '../components/tabbar'
import Task from '../components/task'
import Prompt from '../components/prompt'
import * as Stages from '../functions/stages'
import moment from 'moment'
import SlidingPane from 'react-sliding-pane'
import {
  Drawer,
  DrawerHeader,
  DrawerContent,
  DrawerTitle,
  DrawerScrim,
  DrawerSubtitle
} from 'rmwc/Drawer'
import { remote } from 'electron'
import { Flipper, Flipped } from 'react-flip-toolkit'

const { Header, Sider, Content, Footer } = Layout
const { SubMenu } = Menu
const TabPane = Tabs.TabPane
const Panel = Collapse.Panel

const FormItem = Form.Item
const HOME = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']
const CARMEL_HOME = path.resolve(HOME, '.carmel')
const LIGHT_START = false

export default class Workspace extends Screen {
  constructor (props) {
    super(props)

    this.state = { openFiles: {} }
    this._shell = new Shell()
    this._onProductOption = this.onProductOption.bind(this)
    this._onProductChanged = this.onProductChanged.bind(this)
    this._onShowAccountScreen = this.onShowAccountScreen.bind(this)
    this._onShowTVScreen = this.onShowTVScreen.bind(this)
    this._onShowBountiesScreen = this.onShowBountiesScreen.bind(this)
    this._onTogglePreview = this.onTogglePreview.bind(this)
    this._onSelectChallenge = this.onSelectChallenge.bind(this)
    this._onStartChallenge = this.onStartChallenge.bind(this)
    this._onStopChallenge = this.onStopChallenge.bind(this)
    this._onUnselectChallenge = this.onUnselectChallenge.bind(this)
    this._onShowTask = this.onShowTask.bind(this)
    this._onTaskCompleted = this.onTaskCompleted.bind(this)
    this._onChallengeCompleted = this.onChallengeCompleted.bind(this)
    this._onChallengeRated = this.onChallengeRated.bind(this)
    this._onHideTask = this.onHideTask.bind(this)
    this._onShowCompileErrors = this.onShowCompileErrors.bind(this)
    this._onFileClose = this.onFileClose.bind(this)
    this._onFileTabChanged = this.onFileTabChanged.bind(this)
    this._onFileTabSelected = this.onFileTabSelected.bind(this)
    this._onBuyChallenge = this.onBuyChallenge.bind(this)
    this._onPublishProduct = this.onPublishProduct.bind(this)
  }

  componentDidMount () {
    super.componentDidMount()
    this.start()
  }

  get shell () {
    return this._shell
  }

  get products () {
    return this.props.session.products
  }

  get product () {
    return this.state.product || this.props.session.product
  }

  onShowAccountScreen () {
    this.triggerRedirect(this.isLoggedIn ? '/me' : '/login')
  }

  onShowTVScreen () {
    this.triggerRedirect('/tv')
  }

  onShowBountiesScreen () {
    this.triggerRedirect('/bounties')
  }

  openFile (file) {
    const openFiles = Object.assign({}, this.state.openFiles)

    openFiles[file] = { openTimestamp: `${Date.now}`, fullPath: path.join(this.state.dir, file) }

    this.setState({
      openFiles,
      enableTabs: true,
      lastOpenedFile: file
    })
  }

  showFileBrowser () {
    remote.dialog.showOpenDialog({
      defaultPath: this.state.dir,
      properties: ['openFile']
    }, (files) => {
      if (!files || files.length < 1) {
        return
      }

      const relative = path.relative(this.state.dir, files[0])
      const isOk = !relative.startsWith('..')

      if (!isOk) {
        return
      }

      this.openFile(files[0])
    })
  }

  onShowTask () {
    this.setState({ enableTabs: true })
  }

  onHideTask () {
    this.setState({ enableTabs: false })
  }

  controllerMessage (options) {
    switch (options.type) {
      case 'bonus':
        return `You just unlocked ${options.tokens} CARMEL tokens! ${options.reason}`
      default:
        return `You're awesome`
    }
  }

  get challenges () {
    return this.props.session.challenges.map(challenge => {
      const newChallenge = Object.assign({}, challenge, this.state.userChallenges && this.state.userChallenges[challenge.id] && { history: this.state.userChallenges[challenge.id] })
      return newChallenge
    })
  }

  get challenge () {
    const id = this.state.challengeId
    return this.challenges.find(c => id === c.id)
  }

  updateLocalSession (data) {
    const { challenges, controller, challengeId } = data
    const userChallenges = Object.assign({}, challenges)

    if (!controller) {
      this.setState({ userChallenges, challengeId })
      return
    }

    switch (controller.type) {
      case 'achievement':
        const achievement = controller.achievement
        const popupButtonTitle = 'Continue'
        const popupTitle = 'Congratulations'
        const popupIcon = achievement.type === 'bonus' ? 'tokens' : 'cup'
        const popupMessage = this.controllerMessage(achievement)

        this.setState(Object.assign({}, { userChallenges, challengeId, showPopup: true, popupIcon, popupButtonTitle, popupMessage, popupTitle }))
        break
      default:
    }
  }

  sessionSynced (response) {
    if (!response || !response.data) {
      return
    }

    this.updateLocalSession(response.data)
  }

  failedToSyncSession (error) {
    console.log('failedToSyncSession', error)
  }

  onPublishProduct () {
    this.setState({ productPublishing: true, preview: false })
    this.shell.exec('publishProduct', { id: this.product.id, domain: 'idancali.com' }, ({ status }) => {
      this.setState({ productPublishingStatus: status })
    })
    .then((data) => {
      this.setState({ productPublishing: false, productPublished: true, productPublishingTimestamp: Date.now() })
    })
    .catch((error) => {
      this.setState({ productPublishing: false, productPublished: false, productPublishingError: error })
    })
  }

  startProduct () {
    this.shell.exec('startProduct', { id: this.product.id, light: LIGHT_START }, (compilation) => {
      if (compilation.compiled && !this.state.productStarted) {
        this.setState({ compilation, productStarted: true, productStarting: false })
        return
      }

      this.setState({ compilation })
    })
    .then(({ files, dir, port }) => {
      console.log(port)
      // this.shell.analytics('startProduct', 'success')
      if (LIGHT_START) {
        this.setState({ files, dir, port, productStarted: true, productStarting: false })
        return
      }
      this.setState({ files, dir, port })
    })
    .catch((error) => {
      // this.shell.analytics('startProduct', error.message)
      const compilation = {
        compiled: true,
        compiling: false,
        errors: [error.message]
      }
      this.setState({ compilation, productStarted: true, productStarting: false })
    })
  }

  syncSession (data) {
    const request = Object.assign({},
      { machineId: this.props.session.machineId,
        machineFingerprint: this.props.session.machineFingerprint,
        stage: Stages.WORKSPACE,
        challengeId: ''
      },
      data)

    this.props.syncSession(request)
  }

  start () {
    this.setState({ productStarting: true, productStarted: false })
    this.syncSession()
    return this.startProduct()
  }

  onProductChanged (product) {
    this.shell.cache('productId', product.id)
    this.setState({ product })
  }

  onProductOption (type) {
    console.log('onProductOption', type)
    switch (type) {
      case 'publishProduct':
        this.onPublishProduct()
        break
      case 'newProduct':
        this.triggerRedirect('/new')
        break
      case 'openFile':
        this.showFileBrowser()
        break
      case 'editSettings':
        break
      default:
    }
  }

  onTogglePreview (preview) {
    this.setState({ preview })
  }

  onSelectChallenge ({ challengeId }) {
    this.setState({ challengeId })
  }

  onTaskCompleted ({ taskIndex, challengeId }) {
    this.syncSession({ stage: Stages.TASK_COMPLETED, challengeId })
  }

  onChallengeCompleted ({ challengeId }) {
    this.syncSession({ stage: Stages.CHALLENGE_COMPLETED, challengeId })
  }

  onChallengeRated ({ challengeId, rating }) {
    this.syncSession({ stage: Stages.CHALLENGE_RATED, challengeId, rating })
  }

  onStartChallenge ({ challengeId }) {
    this.syncSession({ stage: Stages.CHALLENGE_STARTED, challengeId })
  }

  onStopChallenge ({ challengeId }) {
    this.syncSession({ stage: Stages.CHALLENGE_STOPPED, challengeId })
  }

  onUnselectChallenge () {
    this.syncSession({ stage: Stages.CHALLENGE_CANCELLED })
    this.setState({ challengeId: '' })
  }

  onFileClose (file) {
    if (this.state.openFiles && this.state.openFiles[file]) {
      const openFiles = Object.assign({}, this.state.openFiles)
      delete openFiles[file]
      this.setState({ openFiles })
    }
  }

  onShowCompileErrors () {
    console.log(this.state.compilation.errors)
  }

  get productStatus () {
    const isStarting = (this.state.productStarting && !this.state.productStarted)
    const isStarted = (!this.state.productStarting && this.state.productStarted)
    const isPublishing = (this.state.productPublishing)
    const isPublished = (!this.state.productPublishing && this.state.productPublished)

    const isCompiling = (isStarted && this.state.compilation && !this.state.compilation.compiled && this.state.compilation.compiling)
    const isCompiled = (isStarted && this.state.compilation && this.state.compilation.compiled && !this.state.compilation.compiling)
    const isCompiledWithErrors = (isCompiled && this.state.compilation.errors && this.state.compilation.errors.length > 0)
    const isCompiledWithoutErrors = (isCompiled && (!this.state.compilation.errors || this.state.compilation.errors.length === 0))

    const status = {
      isStarting,
      isPublishing,
      isStarted,
      isCompiling,
      isCompiled,
      isCompiledWithErrors,
      isCompiledWithoutErrors
    }

    return status
  }

  renderProductStatusPrompt () {
    const status = this.productStatus

    var alertMessage = `The product is starting ...`

    var successColor = '#81C784'
    var progressColor = '#90CAF9'
    var successBackgroundColor = '#FAFAFA'
    var progressBackgroundColor = '#FFFDE7'

    var successIcon = <Icon type='check-circle' style={{ marginRight: '10px', color: successColor }} />
    var progressIcon = <Icon type='hourglass' spin style={{ marginRight: '10px', color: progressColor }} />

    var icon = progressIcon
    var color = progressColor
    var backgroundColor = progressBackgroundColor

    if (status.isPublishing) {
      alertMessage = `${this.state.productPublishingStatus || 'Getting ready to publish your product ...'}`
    } else if (status.isCompiling) {
      alertMessage = 'Applying changes to your product ...'
    } else if (status.isCompiledWithoutErrors) {
      alertMessage = 'Your product is up and running'
      icon = successIcon
      color = successColor
      backgroundColor = successBackgroundColor
    } else if (status.isCompiledWithErrors) {
      const errors = this.state.compilation.errors
      const errorsString = `error${errors.length > 1 ? 's' : ''}`
      alertMessage = `Your latest changes produced ${errors.length} ${errorsString}`
    } else if (status.isPublished) {
      alertMessage = `Your product was successfully published`
      // this.state.productPublishingTimestamp
    }

    return <Typography key='status' style={{
      textAlign: 'center',
      marginBottom: '20px',
      color,
      backgroundColor,
      padding: '10px',
      textAlign: 'center'
    }}>
      { icon }
      { alertMessage }
    </Typography>
  }

  renderProductPreview () {
    const style = Object.assign({}, {
      height: '100vh',
      display: 'flex',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0px',
      flexDirection: 'column',
      backgroundColor: '#f5f5f5'
    }, this.state.preview && {
      marginLeft: '-300px',
      opacity: 0.5
    })

    return <div style={style}>
      <Browser
        cache={this.cache}
        onPublish={this._onPublishProduct}
        status={this.productStatus}
        product={this.state.product}
        port={this.state.port} />
      { this.renderProductStatusPrompt() }
    </div>
  }

  onBuyChallenge (challenge) {
    this.triggerRedirect(this.isLoggedIn ? '/wallet' : '/login')
  }

  renderStartingMessage () {
    return <Prompt
      title='Tweek-N-Learn'
      subtitle='Get Ready To Learn The Carmel Way'>
      <Typography use='subtitle1' style={{
        textAlign: 'center',
        margin: '20px',
        color: '#78909C'
      }}>
        Learning the <strong> Carmel Way </strong> means starting with a real product
        and then taking challenges that teach you to tweak your product by writing small
        chunks of code.
      </Typography>
    </Prompt>
  }

  renderPublishingMessage () {
    return <Prompt
      title='Publishing'
      subtitle='Get Ready To See It Live'>
      <Typography use='subtitle1' style={{
        textAlign: 'center',
        margin: '20px',
        color: '#78909C'
      }}>
        Your website is being packaged right now and
        it may take a minute or two. Once complete, it
        will be published live.
      </Typography>
    </Prompt>
  }

  renderChallenge () {
    return <div key='challenge' style={{
      display: 'flex',
      flex: 1,
      width: '100%',
      flexDirection: 'column'
    }}>
      <Challenge
        onBuyChallenge={this._onBuyChallenge}
        onSelectChallenge={this._onSelectChallenge}
        onStartChallenge={this._onStartChallenge}
        onTaskCompleted={this._onTaskCompleted}
        onChallengeCompleted={this._onChallengeCompleted}
        onChallengeRated={this._onChallengeRated}
        onStopChallenge={this._onStopChallenge}
        account={this.account}
        product={this.product}
        onShowTask={this._onShowTask}
        onHideTask={this._onHideTask}
        onBack={this._onUnselectChallenge}
        challenge={this.challenge} />
    </div>
  }

  renderChallenges () {
    return <div key='challenges' style={{
      display: 'flex',
      flex: 1,
      width: '100%',
      flexDirection: 'column'
    }}>
      <Challenges
        challenges={this.challenges}
        onSelectChallenge={this._onSelectChallenge} />
    </div>
  }

  renderPopup () {
    if (!this.state.showPopup) {
      return <div key='popupContainer' />
    }

    return <PopupMessage
      key='popupContainer'
      buttonTitle={this.state.popupButtonTitle}
      icon={this.state.popupIcon}
      title={this.state.popupTitle}
      message={this.state.popupMessage}
      onClose={() => this.setState({ showPopup: false })}
      message={this.state.popupMessage} />
  }

  renderSideDetails () {
    return <div>
      details
    </div>
  }

  get hasOpenFiles () {
    return this.state.openFiles && Object.keys(this.state.openFiles).length > 0
  }

  onFileTabSelected (file) {
    if (this.state.enableTabs) {
      return
    }
    this.setState({ enableTabs: true })
  }

  onFileTabChanged (file) {
    if (this.state.enableTabs) {
      return
    }
    this.setState({ enableTabs: true })
  }

  renderWorkspaceContent () {
    if (this.state.productPublishing) {
      return this.renderPublishingMessage()
    }

    if (this.state.productStarting) {
      return this.renderStartingMessage()
    }

    if (!this.hasOpenFiles) {
      return (this.state.challengeId ? this.renderChallenge() : this.renderChallenges())
    }

    if (!this.state.enableTabs && this.hasOpenFiles) {
      return <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        width: '100%',
        alignItems: 'center'
      }}>
        <TabBar
          key='tabs'
          hideContent
          onTabChanged={this._onFileTabChanged}
          onFileClose={this._onFileClose}
          onTabSelected={this._onFileTabSelected}
          file={this.state.lastOpenedFile}
          dir={this.state.dir}
          files={this.state.openFiles} />
        { this.state.challengeId ? this.renderChallenge() : this.renderChallenges() }
      </div>
    }

    if (this.state.enableTabs && this.hasOpenFiles) {
      return <div style={{
        flex: 1,
        display: 'flex',
        width: '100%',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <TabBar
          key='tabs'
          onTabChanged={this._onFileTabChanged}
          onTabSelected={this._onFileTabSelected}
          onFileClose={this._onFileClose}
          file={this.state.lastOpenedFile}
          dir={this.state.dir}
          files={this.state.openFiles} />
        <Button onClick={() => {
          this.setState({ enableTabs: false })
        }} style={{
          color: '#FFFFFF',
          backgroundColor: '#00bcd4',
          margin: '10px'
        }}>
          { this.state.challengeId ? 'See Challenge Details' : 'Choose a challenge' }
        </Button>
      </div>
    }

    // return <Flipper flipKey={this.state.workspaceMode}>
    //   <Flipped flipId='default'>
    //     { this.renderWorkspaceContentDefault() }
    //   </Flipped>
    //   <Flipped flipId='editor'>
    //     { this.renderWorkspaceContentEditor() }
    //   </Flipped>
    // </Flipper>
  }

  renderWorkspaceLayout () {
    const width = this.width / (this.state.preview ? 1 : 2)

    return <Layout key='content' style={{
      display: 'flex',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '10px',
      flexDirection: 'column',
      backgroundColor: '#f5f5f5',
      width: `${width}px`
    }}>
      { this.renderWorkspaceContent() }
    </Layout>
  }

  renderWorkspaceMenu () {
    if (this.state.productPublishing || this.state.productStarting) {
      return <div />
    }

    return <Header key='header' style={{
      background: '#ffffff',
      padding: 0,
      borderBottom: '1px #CFD8DC solid'
    }}>
      <Elevation z={2}>
        <Toolbar
          onTogglePreview={this._onTogglePreview}
          onProductOption={this._onProductOption}
          onProductChanged={this._onProductChanged}
          onShowAccountScreen={this._onShowAccountScreen}
          onShowTVScreen={this._onShowTVScreen}
          onShowBountiesScreen={this._onShowBountiesScreen}
          products={this.products}
          product={this.product} />
      </Elevation>
    </Header>
  }

  renderScreenLayout () {
    const w = this.width
    const wSide = (w / 2)

    return <div style={{
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flex: 1,
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Layout key='workspace' style={{ height: '100vh' }}>
        <Sider
          key='preview'
          trigger={null}
          collapsible
          width={`${wSide}px`}
          style={{
            borderRight: '1px #CFD8DC solid',
            height: '100vh'
          }}
          collapsedWidth={'0px'}
          collapsed={this.state.preview}>
          { this.renderProductPreview() }
        </Sider>
        <Layout key='workspace2' style={{
          minHeight: '100vh'
        }}>
          { this.renderWorkspaceMenu() }
          { this.renderWorkspaceLayout() }
        </Layout>
      </Layout>
    </div>
  }
}
