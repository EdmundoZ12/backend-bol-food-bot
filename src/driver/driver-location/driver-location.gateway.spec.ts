import { Test, TestingModule } from '@nestjs/testing';
import { DriverLocationGateway } from './driver-location.gateway';

describe('DriverLocationGateway', () => {
  let gateway: DriverLocationGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DriverLocationGateway],
    }).compile();

    gateway = module.get<DriverLocationGateway>(DriverLocationGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
