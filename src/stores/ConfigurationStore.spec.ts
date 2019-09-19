import { ConfigurationStore } from './ConfigurationStore'

describe('getDefaultChannelDomains', () => {
    it('should the default channel domains', () => {
        let helper = new ConfigurationStore()
        let result = helper.getDefaultChannelDomains()
        expect(result['rChannel']).toEqual([0, 0.7])
        expect(result['gChannel']).toEqual([0, 0.7])
        expect(result['bChannel']).toEqual([0, 0.7])
        expect(result['cChannel']).toEqual([0, 0.7])
        expect(result['mChannel']).toEqual([0, 0.7])
        expect(result['yChannel']).toEqual([0, 0.7])
    })
})

describe('getDefaultChannelMarkers', () => {
    it('should pick default channel markers by priority if they are present', () => {
        let helper = new ConfigurationStore()
        let result = helper.getDefaultChannelMarkers(['FOO', 'CD8', 'CD4', 'CD20', 'BLAH'])
        expect(result['rChannel']).toEqual('CD4')
        expect(result['gChannel']).toEqual('CD8')
        expect(result['bChannel']).toEqual('FOO')
        expect(result['cChannel']).toEqual(null)
        expect(result['mChannel']).toEqual(null)
        expect(result['yChannel']).toEqual(null)
    })
})