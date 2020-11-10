const _ = require('lodash');

describe('Genymotion-Cloud instances lookup service', () => {
  let exec;
  let deviceRegistry;
  let instanceNaming;
  let uut;
  beforeEach(() => {
    const GenyCloudExec = jest.genMockFromModule('../exec/GenyCloudExec');
    exec = new GenyCloudExec();

    const GenyInstanceNaming = jest.genMockFromModule('./GenyInstanceNaming');
    instanceNaming = new GenyInstanceNaming();

    const DeviceRegistry = jest.genMockFromModule('../../../../DeviceRegistry');
    deviceRegistry = new DeviceRegistry();

    const GenyInstancesLookupService = require('./GenyInstanceLookupService');
    uut = new GenyInstancesLookupService(exec, instanceNaming, deviceRegistry);
  });

  const anInstance = () => ({
    uuid: 'mock-instance-uuid',
    name: 'mock-instance-name',
    adb_serial: 'mock-serial:1111',
    state: 'ONLINE',
    recipe: {
      name: 'mock-recipe-name',
      uuid: 'mock-recipe-uuid',
    }
  });
  const aDisconnectedInstance = () => ({
    ...anInstance(),
    adb_serial: '0.0.0.0',
  });
  const anotherInstance = () => ({
    ...anInstance(),
    uuid: 'mock-instance-uuid2',
    name: 'mock-instance-name2',
  });
  const anInstanceOfOtherRecipe = () => ({
    ...anInstance(),
    recipe: {
      name: 'other-mock-recipe-name',
    },
  });

  const givenDevicesBusy = (...instances) => deviceRegistry.getBusyDevices.mockReturnValue([ ...instances.map((instance) => _.pick(instance, 'uuid', 'adbName')) ]);
  const givenAllDevicesFree = () => deviceRegistry.getBusyDevices.mockReturnValue([]);
  const givenInstances = (...instances) => exec.getInstances.mockResolvedValue({ instances });
  const givenNoInstances = () => exec.getInstances.mockResolvedValue({ instances: [] });
  const givenAllDevicesFamilial = () => instanceNaming.isFamilial.mockReturnValue(true);
  const givenNoDevicesFamilial = () => instanceNaming.isFamilial.mockReturnValue(false);

  describe('finding a free instance', () => {
    it('should return null if there are no cloud-instances available', async () => {
      givenNoInstances();
      givenAllDevicesFree();
      givenAllDevicesFamilial();
      expect(await uut.findFreeInstance('mock-recipe-uuid')).toEqual(null);
    });

    it('should return a free instance', async () => {
      const instance = anInstance();
      givenInstances(instance);
      givenAllDevicesFree();
      givenAllDevicesFamilial();

      const result = await uut.findFreeInstance(instance.recipe.uuid);
      expect(result.uuid).toEqual(instance.uuid);
      expect(result.constructor.name).toContain('Instance');
    });

    it('should not return an instance of a different recipe', async () => {
      const instance = anInstance();
      givenInstances(instance);
      givenAllDevicesFree();
      givenAllDevicesFamilial();

      expect(await uut.findFreeInstance('different-recipe-uuid')).toEqual(null);
    });

    it('should not return an instance whose name isn\'t in the family', async () => {
      const instance = anInstance();
      givenInstances(instance);
      givenAllDevicesFree();
      givenNoDevicesFamilial();

      expect(await uut.findFreeInstance(instance.recipe.uuid)).toEqual(null);
      expect(instanceNaming.isFamilial).toHaveBeenCalledWith(instance.name);
    });

    it('should not return an instance marked "busy"', async () => {
      const instance = anInstance();
      givenInstances(instance);
      givenDevicesBusy(instance);
      givenAllDevicesFamilial();

      expect(await uut.findFreeInstance(instance.recipe.uuid)).toEqual(null);
    });

    it('should not return a recycled (auto-shutdown) instance', async () => {
      const instance = {
        ...anInstance(),
        state: 'RECYCLED',
      };
      givenInstances(instance);
      givenAllDevicesFree();
      givenAllDevicesFamilial();

      expect(await uut.findFreeInstance(instance.recipe.uuid)).toEqual(null);
    });

    it('should filter multiple matches of multiple instances', async () => {
      const instance = anInstance();
      givenInstances(anInstanceOfOtherRecipe(), instance, anotherInstance());
      givenAllDevicesFree();
      givenAllDevicesFamilial();

      const result = await uut.findFreeInstance(instance.recipe.uuid);
      expect(result.uuid).toEqual(instance.uuid);
    });
  });

  describe('finding a specific instance', () => {
    it('should return an instance matching a UUID', async () => {
      const instance1 = anInstance();
      const instance2 = anotherInstance();
      givenInstances(instance1, instance2);

      const result = await uut.getInstance(instance2.uuid);
      expect(result.uuid).toEqual(instance2.uuid);
    });
  });
});
